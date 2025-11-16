/**
 * NFT Service
 * Business logic layer for NFT operations
 */

import { NFTRepository } from '@/lib/repositories/nft.repository';
import { IPFSService } from '@/lib/services/ipfs.service';
import { mintProductNFT, getTokenProperties, getTokenOwner } from '@/lib/blockchain/contract';
import { parseNeoError } from '@/lib/blockchain/errors';
import { getExplorerTxUrl } from '@/lib/blockchain/config';

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
  updatedAt: string;
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
      const expiryDate = data.expiryDate || Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year

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
        transactionHash: txResult.txHash,
      });

      return {
        success: true,
        nft,
        transactionHash: txResult.txHash,
        explorerUrl: getExplorerTxUrl(txResult.txHash),
      };
    } catch (error: any) {
      const neoError = parseNeoError(error);
      return {
        success: false,
        error: neoError.message,
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
        blockchainOwner = await getTokenOwner(tokenId);
        blockchainMetadata = await getTokenProperties(tokenId);
      } catch (error) {
        console.warn('Failed to fetch blockchain data:', error);
      }

      // Get IPFS metadata
      let ipfsMetadata: any = null;
      if (nft.ipfsHash) {
        try {
          ipfsMetadata = await this.ipfsService.getMetadata(nft.ipfsHash);
        } catch (error) {
          console.warn('Failed to fetch IPFS metadata:', error);
        }
      }

      return {
        ...nft,
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
  async getNFTsByOwner(owner: string): Promise<any[]> {
    try {
      return await this.nftRepo.findByOwner(owner.toLowerCase());
    } catch (error) {
      console.error('Error getting NFTs by owner:', error);
      return [];
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
      return await this.nftRepo.findByStatus(status);
    } catch (error) {
      console.error('Error getting NFTs by status:', error);
      return [];
    }
  }
}

