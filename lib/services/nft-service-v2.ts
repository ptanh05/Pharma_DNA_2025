/**
 * NFT Service v2
 * Updated NFT service with blockchain service integration
 */

import { NFTRepository } from '@/lib/repositories/nft.repository';
import { IPFSService } from '@/lib/services/ipfs.service';
import { getBlockchainService } from '@/lib/blockchain/blockchain-service';
import { parseSuiError } from '@/lib/blockchain/errors-sui';
import { getExplorerTxUrl } from '@/lib/blockchain/config-sui';
import { getSuiClient } from '@/lib/blockchain/provider-sui';
import { logWarn, logError } from '@/lib/logger';

export interface MintNFTData {
    ipfsHash: string;
    account: string;
    batchNumber?: string;
    expiryDate?: number;
    productName?: string;
    metadata?: Record<string, any>;
    usePaymaster?: boolean;
}

export interface TransferNFTData {
    objectId: string;
    toAddress: string;
    usePaymaster?: boolean;
}

export interface UpdateStatusData {
    objectId: string;
    newStatus: number;
    reason: string;
    usePaymaster?: boolean;
}

export interface MintResult {
    success: boolean;
    nft?: any;
    transactionHash?: string;
    explorerUrl?: string;
    error?: string;
}

export interface TransferResult {
    success: boolean;
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

export class NFTServiceV2 {
    private nftRepo: NFTRepository;
    private ipfsService: IPFSService;
    private blockchainService: ReturnType<typeof getBlockchainService>;

    constructor() {
        this.nftRepo = new NFTRepository();
        this.ipfsService = new IPFSService();
        this.blockchainService = getBlockchainService();
    }

    /**
     * Mint NFT with new blockchain service
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

            // Default values
            const batchNumber = data.batchNumber || `BATCH-${Date.now()}`;
            const productName = data.productName || `PharmaNFT-${Date.now()}`;
            const expiryDate = data.expiryDate || Date.now() + (365 * 24 * 60 * 60 * 1000);

            // Execute mint transaction
            const result = await this.blockchainService.mintNFT(
                data.account,
                batchNumber,
                productName,
                expiryDate,
                data.ipfsHash,
                { usePaymaster: data.usePaymaster }
            );

            if (!result.success) {
                return {
                    success: false,
                    error: result.error || 'Lỗi khi mint NFT trên blockchain',
                };
            }

            // Save to database
            const nft = await this.nftRepo.create({
                name: productName,
                status: 'minted',
                manufacturerAddress: data.account.toLowerCase(),
                ipfsHash: data.ipfsHash,
                batchNumber,
                transactionHash: result.digest,
            });

            return {
                success: true,
                nft,
                transactionHash: result.digest,
                explorerUrl: getExplorerTxUrl(result.digest),
            };
        } catch (error: any) {
            const errorMessage = parseSuiError(error);
            return {
                success: false,
                error: errorMessage,
            };
        }
    }

    /**
     * Transfer NFT to another address
     */
    async transferNFT(data: TransferNFTData): Promise<TransferResult> {
        try {
            if (!data.objectId || !data.toAddress) {
                return {
                    success: false,
                    error: 'Thiếu thông tin: objectId và toAddress là bắt buộc',
                };
            }

            // Validate address format
            if (!data.toAddress.startsWith('0x') || data.toAddress.length !== 66) {
                return {
                    success: false,
                    error: 'Địa chỉ ví không hợp lệ',
                };
            }

            // Execute transfer
            const result = await this.blockchainService.transferNFT(
                '', // Will use sender from wallet in frontend
                data.objectId,
                data.toAddress,
                { usePaymaster: data.usePaymaster }
            );

            if (!result.success) {
                return {
                    success: false,
                    error: result.error || 'Lỗi khi chuyển NFT',
                };
            }

            // Update database
            await this.nftRepo.updateStatus(
                parseInt(data.objectId.slice(-8), 16),
                'transferred',
                data.toAddress.toLowerCase(),
                'distributor'
            );

            return {
                success: true,
                transactionHash: result.digest,
                explorerUrl: getExplorerTxUrl(result.digest),
            };
        } catch (error: any) {
            return {
                success: false,
                error: parseSuiError(error),
            };
        }
    }

    /**
     * DEPRECATED: Update NFT status
     * NOTE: This method fails because the Move contract does NOT have an update_status function.
     * NFT status changes implicitly through transfers.
     */
    async DEPRECATED_updateStatus(data: UpdateStatusData): Promise<TransferResult> {
        try {
            if (!data.objectId || data.newStatus === undefined) {
                return {
                    success: false,
                    error: 'Thiếu thông tin: objectId và newStatus là bắt buộc',
                };
            }

            const result = await this.blockchainService.DEPRECATED_updateNFTStatus(
                '',
                data.objectId,
                data.newStatus,
                data.reason,
                { usePaymaster: data.usePaymaster }
            );

            if (!result.success) {
                return {
                    success: false,
                    error: result.error || 'Lỗi khi cập nhật trạng thái',
                };
            }

            return {
                success: true,
                transactionHash: result.digest,
                explorerUrl: getExplorerTxUrl(result.digest),
            };
        } catch (error: any) {
            return {
                success: false,
                error: parseSuiError(error),
            };
        }
    }

    /**
     * Get NFT with full metadata
     */
    async getNFTWithMetadata(tokenId: number): Promise<NFTWithMetadata | null> {
        try {
            const nft = await this.nftRepo.findById(tokenId);
            if (!nft) {
                return null;
            }

            // Get blockchain data
            let blockchainOwner: string | null = null;
            let blockchainMetadata: any = null;

            try {
                blockchainOwner = await this.getOwnerFromBlockchain(
                    nft.object_id || ''
                );
                blockchainMetadata = await this.getMetadataFromBlockchain(
                    nft.object_id || ''
                );
            } catch (error) {
                logWarn('Failed to fetch blockchain data', { objectId: nft.object_id || '' });
            }

            // Get IPFS metadata
            let ipfsMetadata: any = null;
            if (nft.ipfs_hash) {
                try {
                    ipfsMetadata = await this.ipfsService.getMetadata(nft.ipfs_hash);
                } catch (error) {
                    logWarn('Failed to fetch IPFS metadata', { ipfsHash: nft.ipfs_hash });
                }
            }

            return {
                id: nft.id,
                name: nft.name,
                status: nft.status,
                manufacturerAddress: nft.manufacturer_address,
                distributorAddress: nft.distributor_address,
                pharmacyAddress: nft.pharmacy_address,
                ipfsHash: nft.ipfs_hash,
                batchNumber: nft.batch_number,
                transactionHash: nft.transaction_hash,
                blockchainOwner: blockchainOwner || undefined,
                blockchainMetadata,
                ipfsMetadata,
                createdAt: nft.created_at,
                updatedAt: nft.updated_at,
            };
        } catch (error) {
            logError('Error getting NFT with metadata', error, { tokenId });
            return null;
        }
    }

    /**
     * Get NFTs by owner
     */
    async getNFTsByOwner(owner: string): Promise<any[]> {
        try {
            return await this.nftRepo.findByOwner(owner.toLowerCase());
        } catch (error) {
            logError('Error getting NFTs by owner', error, { owner });
            return [];
        }
    }

    /**
     * Assign role to user
     */
    async assignRole(
        senderAddress: string,
        userAddress: string,
        role: number,
        usePaymaster: boolean = false
    ): Promise<TransferResult> {
        try {
            const result = await this.blockchainService.assignRole(
                senderAddress,
                userAddress,
                role,
                { usePaymaster }
            );

            if (!result.success) {
                return {
                    success: false,
                    error: result.error || 'Lỗi khi phân quyền',
                };
            }

            return {
                success: true,
                transactionHash: result.digest,
                explorerUrl: getExplorerTxUrl(result.digest),
            };
        } catch (error: any) {
            return {
                success: false,
                error: parseSuiError(error),
            };
        }
    }

    /**
     * DEPRECATED: Verify participant
     * NOTE: This method fails because the Move contract does NOT have a verify_participant function.
     * Role verification should be done via getRole().
     */
    async DEPRECATED_verifyParticipant(
        senderAddress: string,
        participantAddress: string,
        usePaymaster: boolean = false
    ): Promise<TransferResult> {
        try {
            const result = await this.blockchainService.DEPRECATED_verifyParticipant(
                senderAddress,
                participantAddress,
                { usePaymaster }
            );

            if (!result.success) {
                return {
                    success: false,
                    error: result.error || 'Lỗi khi xác minh',
                };
            }

            return {
                success: true,
                transactionHash: result.digest,
                explorerUrl: getExplorerTxUrl(result.digest),
            };
        } catch (error: any) {
            return {
                success: false,
                error: parseSuiError(error),
            };
        }
    }

    /**
     * Get paymaster status
     */
    async getPaymasterStatus(): Promise<{
        enabled: boolean;
        balance: string;
        isHealthy: boolean;
    }> {
        return this.blockchainService.getPaymasterStatus();
    }

    // Helper methods
    private async getOwnerFromBlockchain(objectId: string): Promise<string | null> {
        if (!objectId) return null;
        try {
            const client = getSuiClient();
            const object = await client.getObject({
                id: objectId,
                options: {
                    showOwner: true,
                },
            });
            if (!object.data) return null;
            const owner = object.data.owner;
            if (!owner) return null;
            // Owner can be an address string, an address-owned object, or a shared object
            if (typeof owner === 'string') return owner;
            if ('owner' in owner) {
                // Address-owned
                return typeof owner.owner === 'string' ? owner.owner : null;
            }
            // Shared or immutable - no single owner
            return null;
        } catch {
            return null;
        }
    }

    private async getMetadataFromBlockchain(objectId: string): Promise<any> {
        try {
            return await this.blockchainService.getNFTInfo(objectId);
        } catch {
            return null;
        }
    }
}

// Export singleton instance
let nftServiceV2Instance: NFTServiceV2 | null = null;

export function getNFTServiceV2(): NFTServiceV2 {
    if (!nftServiceV2Instance) {
        nftServiceV2Instance = new NFTServiceV2();
    }
    return nftServiceV2Instance;
}

export default NFTServiceV2;
