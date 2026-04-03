/**
 * NFT Client for Frontend
 * High-level API for NFT operations in the frontend
 */

'use client';

import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { getSuiRpcUrl } from './config-sui';

export interface NFT {
    objectId: string;
    batchNumber: string;
    productName: string;
    manufacturer: string;
    owner: string;
    status: number;
    expirationDate: number;
    metadataUri: string;
    createdAt: number;
    updatedAt: number;
}

export interface NFTMintParams {
    batchNumber: string;
    productName: string;
    expirationDate: number;
    metadataUri: string;
}

export interface NFTTransferParams {
    objectId: string;
    toAddress: string;
}

export interface NFTStatusUpdateParams {
    objectId: string;
    newStatus: number;
    reason: string;
}

class NFTClient {
    private client: SuiClient;
    private packageId: string;
    private contractObjectId: string;

    constructor() {
        this.client = new SuiClient({
            url: getSuiRpcUrl(),
        });
        this.packageId = process.env.NEXT_PUBLIC_SUI_PACKAGE_ID || '';
        this.contractObjectId = process.env.NEXT_PUBLIC_SUI_CONTRACT_OBJECT_ID || '';
    }

    /**
     * Get NFT by object ID
     */
    async getNFT(objectId: string): Promise<NFT | null> {
        try {
            const object = await this.client.getObject({
                id: objectId,
                options: {
                    showType: true,
                    showContent: true,
                    showOwner: true,
                },
            });

            if (!object.data) {
                return null;
            }

            const content = object.data.content as any;
            const fields = content?.fields || {};

            return {
                objectId,
                batchNumber: fields.batch_number || '',
                productName: fields.product_name || '',
                manufacturer: fields.manufacturer || '',
                owner: typeof object.data.owner === 'object'
                    ? object.data.owner.AddressOwner
                    : object.data.owner,
                status: fields.current_status || 0,
                expirationDate: Number(fields.expiration_date) || 0,
                metadataUri: fields.metadata_uri || '',
                createdAt: Number(fields.created_at) || 0,
                updatedAt: Number(fields.last_updated) || 0,
            };
        } catch (error) {
            console.error('Error getting NFT:', error);
            return null;
        }
    }

    /**
     * Get NFTs owned by an address
     */
    async getNFTsByOwner(address: string): Promise<NFT[]> {
        try {
            const objects = await this.client.getOwnedObjects({
                owner: address,
                filter: {
                    StructType: `${this.packageId}::pharma_nft::PharmaNFT`,
                },
                options: {
                    showType: true,
                    showContent: true,
                },
            });

            const nfts: NFT[] = [];
            for (const obj of objects.data) {
                if (obj.data?.objectId) {
                    const nft = await this.getNFT(obj.data.objectId);
                    if (nft) {
                        nfts.push(nft);
                    }
                }
            }

            return nfts;
        } catch (error) {
            console.error('Error getting NFTs by owner:', error);
            return [];
        }
    }

    /**
     * Get NFTs by manufacturer
     */
    async getNFTsByManufacturer(manufacturer: string): Promise<NFT[]> {
        try {
            const objects = await this.client.getOwnedObjects({
                owner: manufacturer,
                filter: {
                    StructType: `${this.packageId}::pharma_nft::PharmaNFT`,
                },
                options: {
                    showType: true,
                    showContent: true,
                },
            });

            const nfts: NFT[] = [];
            for (const obj of objects.data) {
                if (obj.data?.objectId) {
                    const nft = await this.getNFT(obj.data.objectId);
                    if (nft && nft.manufacturer.toLowerCase() === manufacturer.toLowerCase()) {
                        nfts.push(nft);
                    }
                }
            }

            return nfts;
        } catch (error) {
            console.error('Error getting NFTs by manufacturer:', error);
            return [];
        }
    }

    /**
     * Create mint transaction
     */
    createMintTransaction(params: NFTMintParams): TransactionBlock {
        const tx = new TransactionBlock();

        const [nft] = tx.moveCall({
            target: `${this.packageId}::pharma_nft::mint_product_nft`,
            arguments: [
                tx.object(this.contractObjectId),
                tx.pure(params.batchNumber),
                tx.pure(params.productName),
                tx.pure(Math.floor(Date.now() / 1000)),
                tx.pure(Math.floor(params.expirationDate / 1000)),
                tx.pure(params.metadataUri),
                tx.object('0x6'), // Clock
            ],
        });

        tx.transferObjects([nft], tx.pure(process.env.NEXT_PUBLIC_WALLET_ADDRESS || ''));

        return tx;
    }

    /**
     * Create transfer transaction
     */
    createTransferTransaction(params: NFTTransferParams): TransactionBlock {
        const tx = new TransactionBlock();

        tx.moveCall({
            target: `${this.packageId}::pharma_nft::transfer_product_nft`,
            arguments: [
                tx.object(params.objectId),
                tx.object(this.contractObjectId),
                tx.pure(params.toAddress),
                tx.object('0x6'), // Clock
            ],
        });

        return tx;
    }

    /**
     * DEPRECATED: Create status update transaction
     * NOTE: The Move contract does NOT have an update_status function.
     * NFT status changes implicitly through transfers.
     */
    createDEPRECATEDStatusUpdateTransaction(_params: NFTStatusUpdateParams): TransactionBlock {
        // NOTE: The Move contract does NOT have an update_status function.
        // NFT status changes implicitly through transfers.
        // This method is deprecated and creates a no-op transaction.
        console.warn('update_status is deprecated in the Move contract');
        return new TransactionBlock();
    }

    /**
     * Get role of an address
     */
    async getRole(address: string): Promise<number> {
        try {
            const tx = new TransactionBlock();
            tx.moveCall({
                target: `${this.packageId}::pharma_nft::get_user_role`,
                arguments: [
                    tx.object(this.contractObjectId),
                    tx.pure(address),
                ],
            });

            const result = await this.client.dryRunTransactionBlock({
                transactionBlock: await tx.build({ client: this.client }),
            });

            if (result.effects.status.status === 'success' && result.returnValues) {
                return Number(result.returnValues[0]?.value || 0);
            }

            return 0;
        } catch (error) {
            console.error('Error getting role:', error);
            return 0;
        }
    }

    /**
     * Check if contract is paused
     */
    async isContractPaused(): Promise<boolean> {
        try {
            const object = await this.client.getObject({
                id: this.contractObjectId,
                options: {
                    showContent: true,
                },
            });

            const content = object.data?.content as any;
            return content?.fields?.paused || false;
        } catch (error) {
            console.error('Error checking contract pause status:', error);
            return false;
        }
    }

    /**
     * Get transaction status
     */
    async getTransactionStatus(digest: string): Promise<{
        status: 'success' | 'failure' | 'pending';
        timestamp?: number;
    }> {
        try {
            const tx = await this.client.getTransactionBlock({
                digest,
                options: {
                    showEffects: true,
                    showInput: true,
                },
            });

            return {
                status: tx.effects?.status?.status === 'success' ? 'success' : 'failure',
                timestamp: tx.timestampMs ? Number(tx.timestampMs) : undefined,
            };
        } catch (error) {
            console.error('Error getting transaction status:', error);
            return { status: 'pending' };
        }
    }
}

// Export singleton instance
let nftClientInstance: NFTClient | null = null;

export function getNFTClient(): NFTClient {
    if (!nftClientInstance) {
        nftClientInstance = new NFTClient();
    }
    return nftClientInstance;
}

export default NFTClient;
