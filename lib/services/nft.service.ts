/**
 * NFT Service
 * Business logic layer for NFT operations
 */

import { NFTRepository } from '@/lib/repositories/nft.repository';
import { IPFSService } from '@/lib/services/ipfs.service';
import { mintProductNFT, getTokenProperties, getTokenOwner } from '@/lib/blockchain/contract';
import { parseSuiError } from '@/lib/blockchain/errors-sui';
import { getSuiExplorerTxUrl as getExplorerTxUrl } from '@/lib/blockchain/config-sui';

export interface MintNFTData {
  ipfsHash: string;
  account: string;
  batchNumber?: string;
  expiryDate?: number;
  metadata?: Record<string, any>;
}

export interface MintResult {
  success: boolean;
  nft?: any;
  transactionHash?: string;
  explorerUrl?: string;
  error?: string;
}

export interface NFTWithMetadata {
  id: number;
  name: string;
  status: string;
  manufacturerAddress: string;
  distributorAddress?: string;
  pharmacyAddress?: string;
  ipfsHash: string;
  batchNumber: string;
  transactionHash?: string;
  blockchainOwner?: string;
  blockchainMetadata?: any;
  ipfsMetadata?: any;
  createdAt: string;
  updatedAt?: string;
}

export class NFTService {
  constructor(
    private nftRepo: NFTRepository,
    private ipfsService: IPFSService
  ) {}

  /**
   * Mint NFT on blockchain and save to database
   */
  async mintNFT(data: MintNFTData): Promise<MintResult> {
    try {
      // Validate required fields
      if (!data.ipfsHash || !data.account) {
        return {
          success: false,
          error: 'Thiếu thông tin: ipfsHash và account là bắt buộc',
        };
      }

      // Check private key
      const privateKey = process.env.OWNER_PRIVATE_KEY;
      if (!privateKey) {
        return {
          success: false,
          error: 'OWNER_PRIVATE_KEY không được cấu hình',
        };
      }

      // Default values
      const batchNumber = data.batchNumber || `BATCH-${Date.now()}`;
      // Sui uses milliseconds for timestamps
      const expiryDate = data.expiryDate || Date.now() + (365 * 24 * 60 * 60 * 1000); // 1 year

      // Mint on blockchain
      const txResult = await mintProductNFT(
        data.ipfsHash,
        batchNumber,
        expiryDate,
        privateKey
      );

      if (!txResult.success) {
        return {
          success: false,
          error: txResult.error || 'Lỗi khi mint NFT trên blockchain',
        };
      }

      // Save to database
      const nft = await this.nftRepo.create({
        name: `NFT-${Date.now()}`,
        status: 'minted',
        manufacturerAddress: data.account.toLowerCase(),
        ipfsHash: data.ipfsHash,
        batchNumber,
        transactionHash: txResult.digest,
        // FIXED: objectId not in CreateNFTData interface - removed
      });

      return {
        success: true,
        nft,
        transactionHash: txResult.digest,
        explorerUrl: getExplorerTxUrl(txResult.digest),
      };
    } catch (error: any) {
      const suiError = parseSuiError(error);
      // FIXED: Handle both string and object error types
      const errorMessage = typeof suiError === 'string' 
        ? suiError 
        : (suiError && typeof suiError === 'object' && 'message' in suiError) 
          ? (suiError as any).message 
          : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get NFT with full metadata (database + blockchain + IPFS)
   */
  async getNFTWithMetadata(tokenId: number): Promise<NFTWithMetadata | null> {
    try {
      // Get from database
      const nft = await this.nftRepo.findById(tokenId);
      if (!nft) {
        return null;
      }

      // Get blockchain data
      let blockchainOwner: string | null = null;
      let blockchainMetadata: any = null;
      
      try {
        // FIXED: Convert tokenId (number) to string for blockchain functions
        blockchainOwner = await getTokenOwner(String(tokenId));
        blockchainMetadata = await getTokenProperties(String(tokenId));
      } catch (error) {
        console.warn('Failed to fetch blockchain data:', error);
      }

      // Get IPFS metadata
      let ipfsMetadata: any = null;
      // FIXED: Use ipfs_hash instead of ipfsHash
      if (nft.ipfs_hash) {
        try {
          ipfsMetadata = await this.ipfsService.getMetadata(nft.ipfs_hash);
        } catch (error) {
          console.warn('Failed to fetch IPFS metadata:', error);
        }
      }

      // FIXED: Map database fields to NFTWithMetadata interface
      return {
        id: nft.id,
        name: nft.name,
        status: nft.status,
        manufacturerAddress: nft.manufacturer_address,
        distributorAddress: nft.distributor_address || undefined,
        pharmacyAddress: nft.pharmacy_address || undefined,
        ipfsHash: nft.ipfs_hash,
        batchNumber: nft.batch_number,
        transactionHash: nft.transaction_hash || undefined,
        createdAt: nft.created_at,
        updatedAt: nft.updated_at || undefined,
        blockchainOwner: blockchainOwner || undefined,
        blockchainMetadata,
        ipfsMetadata,
      };
    } catch (error) {
      console.error('Error getting NFT with metadata:', error);
      return null;
    }
  }

  /**
   * Get NFTs by owner address
   */
  async getNFTsByOwner(owner: string): Promise<{ nfts: any[]; total: number }> {
    try {
      return await this.nftRepo.findByOwner(owner.toLowerCase());
    } catch (error) {
      console.error('Error getting NFTs by owner:', error);
      return { nfts: [], total: 0 };
    }
  }

  /**
   * Update NFT status
   */
  async updateStatus(tokenId: number, status: string, address?: string, addressType?: 'distributor' | 'pharmacy'): Promise<boolean> {
    try {
      await this.nftRepo.updateStatus(tokenId, status, address, addressType);
      return true;
    } catch (error) {
      console.error('Error updating NFT status:', error);
      return false;
    }
  }

  /**
   * Get NFTs by status
   */
  async getNFTsByStatus(status: string): Promise<any[]> {
    try {
      const result = await this.nftRepo.findByStatus(status);
      return result.nfts;
    } catch (error) {
      console.error('Error getting NFTs by status:', error);
      return [];
    }
  }
}

