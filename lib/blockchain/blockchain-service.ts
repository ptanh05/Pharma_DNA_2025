/**
 * Comprehensive Blockchain Service
 * Combines contract interaction, paymaster, and security features
 */

import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { getSuiClient, getPackageId, getContractObjectId, getAdminCapObjectId, validateSuiAddress } from './provider-sui';
import { parsePrivateKey, signAndSendTransaction } from './contract-sui';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { parseSuiError } from './errors-sui';
import { PaymasterService, getPaymasterService } from './paymaster';
import { SecurityValidator, getSecurityValidator } from './security-validator';

export interface BlockchainConfig {
    /** RPC URL */
    rpcUrl: string;
    /** Package ID */
    packageId: string;
    /** Contract Object ID */
    contractObjectId: string;
    /** Owner private key for admin operations */
    ownerPrivateKey: string;
    /** Enable gasless transactions */
    enablePaymaster: boolean;
    /** Enable security validation */
    enableSecurityCheck: boolean;
}

export interface TransactionOptions {
    /** Use paymaster for gasless transaction */
    usePaymaster?: boolean;
    /** Enable security validation */
    validateSecurity?: boolean;
    /** Transaction timeout in ms */
    timeout?: number;
}

export interface TransactionResult {
    success: boolean;
    digest?: string;
    objectId?: string;
    error?: string;
    gasUsed?: string;
    timestamp?: number;
}

export class BlockchainService {
    private client: SuiClient;
    private packageId: string;
    private contractObjectId: string;
    private adminCapObjectId: string;
    private ownerKeypair: Ed25519Keypair | null = null;
    private ownerAddress: string = '';
    private ownerPrivateKey: string = '';
    private paymaster: PaymasterService | null;
    private securityValidator: SecurityValidator;

    constructor(config?: Partial<BlockchainConfig>) {
        // Default configuration - handle null values
        const packageId = getPackageId();
        const contractObjectId = getContractObjectId();

        const fullConfig: BlockchainConfig = {
            rpcUrl: process.env.SUI_RPC_URL || 'https://fullnode.testnet.sui.io',
            packageId: packageId || '0x0000000000000000000000000000000000000000000000000000000000000000',
            contractObjectId: contractObjectId || '0x0000000000000000000000000000000000000000000000000000000000000000',
            ownerPrivateKey: process.env.OWNER_PRIVATE_KEY || '',
            enablePaymaster: process.env.ENABLE_PAYMASTER === 'true',
            enableSecurityCheck: process.env.ENABLE_SECURITY_CHECK !== 'false',
            ...config,
        };

        this.client = getSuiClient();
        this.packageId = fullConfig.packageId;
        this.contractObjectId = fullConfig.contractObjectId;
        this.adminCapObjectId = getAdminCapObjectId() || '0x0000000000000000000000000000000000000000000000000000000000000000';
        this.securityValidator = getSecurityValidator();

        // Initialize owner keypair
        if (fullConfig.ownerPrivateKey) {
            this.ownerPrivateKey = fullConfig.ownerPrivateKey;
            this.ownerKeypair = parsePrivateKey(fullConfig.ownerPrivateKey);
            this.ownerAddress = this.ownerKeypair.toSuiAddress();
        }

        // Initialize paymaster if enabled
        if (fullConfig.enablePaymaster) {
            try {
                this.paymaster = getPaymasterService();
            } catch (error) {
                console.warn('Paymaster initialization failed:', error);
                this.paymaster = null;
            }
        }
    }

    /**
     * Get contract package ID
     */
    getPackageId(): string {
        return this.packageId;
    }

    /**
     * Get contract object ID
     */
    getContractObjectId(): string {
        return this.contractObjectId;
    }

    /**
     * Get owner address
     */
    getOwnerAddress(): string {
        return this.ownerAddress;
    }

    /**
     * Create a new transaction block
     */
    createTransaction(): TransactionBlock {
        return new TransactionBlock();
    }

    /**
     * Execute a transaction with optional paymaster and security features
     */
    async executeTransaction(
        transaction: TransactionBlock,
        senderAddress: string,
        options: TransactionOptions = {}
    ): Promise<TransactionResult> {
        const {
            usePaymaster = false,
            validateSecurity = this.securityValidator ? true : false,
            timeout = 60000,
        } = options;

        try {
            // 1. Security validation
            if (validateSecurity) {
                const validation = await this.securityValidator.validateTransaction(
                    transaction,
                    senderAddress
                );

                if (!validation.valid) {
                    return {
                        success: false,
                        error: `Security validation failed: ${validation.errors.join(', ')}`,
                    };
                }

                if (validation.score < 50) {
                    console.warn(
                        `Low security score (${validation.score}): ${validation.warnings.join(', ')}`
                    );
                }
            }

            // 2. Check if we should use paymaster
            if (usePaymaster && this.paymaster) {
                const paymasterResult = await this.paymaster.executeGaslessTransaction(
                    senderAddress,
                    transaction
                );

                if (paymasterResult.success) {
                    return {
                        success: true,
                        digest: paymasterResult.digest,
                        timestamp: Date.now(),
                    };
                } else {
                    return {
                        success: false,
                        error: paymasterResult.error || 'Paymaster transaction failed',
                    };
                }
            }

            // 3. Execute regular transaction
            // Set sender if not already set
            if (!transaction.blockData.sender) {
                transaction.setSender(senderAddress);
            }

            const result = await signAndSendTransaction(
                transaction,
                this.ownerPrivateKey
            );

            if (result.success) {
                return {
                    success: true,
                    digest: result.digest,
                    timestamp: Date.now(),
                };
            } else {
                return {
                    success: false,
                    error: parseSuiError(result.error),
                };
            }
        } catch (error) {
            return {
                success: false,
                error: parseSuiError(error),
            };
        }
    }

    /**
     * Mint a new pharmaceutical NFT
     */
    async mintNFT(
        senderAddress: string,
        batchNumber: string,
        productName: string,
        expirationDate: number,
        metadataUri: string,
        options: TransactionOptions = {}
    ): Promise<TransactionResult> {
        const tx = new TransactionBlock();

        const [nft] = tx.moveCall({
            target: `${this.packageId}::pharma_nft::mint_product_nft`,
            arguments: [
                tx.object(this.contractObjectId),
                tx.pure(batchNumber),
                tx.pure(productName),
                tx.pure(Math.floor(Date.now() / 1000)),
                tx.pure(Math.floor(expirationDate / 1000)),
                tx.pure(metadataUri),
                tx.object('0x6'), // Clock object
            ],
        });

        tx.transferObjects([nft], senderAddress);

        const result = await this.executeTransaction(tx, senderAddress, options);

        if (result.success && result.digest) {
            // Extract object ID from transaction
            try {
                const txInfo = await this.client.getTransactionBlock({
                    digest: result.digest,
                    options: { showObjectChanges: true },
                });

                const createdNft = txInfo.objectChanges?.find(
                    (change: any) => change.type === 'created' &&
                        change.objectType?.includes('PharmaNFT')
                );

                if (createdNft) {
                    result.objectId = createdNft.objectId;
                }
            } catch (error) {
                console.error('Error extracting NFT object ID:', error);
            }
        }

        return result;
    }

    /**
     * Transfer NFT to another address
     */
    async transferNFT(
        senderAddress: string,
        nftObjectId: string,
        toAddress: string,
        options: TransactionOptions = {}
    ): Promise<TransactionResult> {
        const tx = new TransactionBlock();

        tx.moveCall({
            target: `${this.packageId}::pharma_nft::transfer_product_nft`,
            arguments: [
                tx.object(nftObjectId),
                tx.object(this.contractObjectId),
                tx.pure(toAddress),
                tx.object('0x6'), // Clock
            ],
        });

        return this.executeTransaction(tx, senderAddress, options);
    }

    /**
     * DEPRECATED: Update NFT status
     * NOTE: This method fails because the Move contract does NOT have an update_status function.
     * NFT status changes implicitly through transfers.
     * This method is deprecated and kept for backward compatibility only.
     * Do not use - will always return an error.
     */
    async DEPRECATED_updateNFTStatus(
        _senderAddress: string,
        _nftObjectId: string,
        _newStatus: number,
        _reason: string,
        _options: TransactionOptions = {}
    ): Promise<TransactionResult> {
        return {
            success: false,
            error: 'updateNFTStatus is deprecated. Status changes implicitly through NFT transfers in the Move contract.',
        };
    }

    /**
     * Assign role to a user
     * Uses assign_role_by_admin which requires AdminCap
     */
    async assignRole(
        senderAddress: string,
        userAddress: string,
        role: number,
        options: TransactionOptions = {}
    ): Promise<TransactionResult> {
        const tx = new TransactionBlock();

        tx.moveCall({
            target: `${this.packageId}::pharma_nft::assign_role`,
            arguments: [
                tx.object(this.contractObjectId),
                tx.object(this.adminCapObjectId),
                tx.pure(userAddress),
                tx.pure(role),
            ],
        });

        return this.executeTransaction(tx, senderAddress, options);
    }

    /**
     * DEPRECATED: Verify a participant
     * NOTE: This method fails because the Move contract does NOT have a verify_participant function.
     * Role verification should be done via get_user_role.
     * This method is deprecated and will always return an error.
     */
    async DEPRECATED_verifyParticipant(
        _senderAddress: string,
        _participantAddress: string,
        _options: TransactionOptions = {}
    ): Promise<TransactionResult> {
        return {
            success: false,
            error: 'verifyParticipant is deprecated. Use getRole() to check participant roles.',
        };
    }

    /**
     * Get NFT information
     */
    async getNFTInfo(nftObjectId: string): Promise<any | null> {
        try {
            const object = await this.client.getObject({
                id: nftObjectId,
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
            return {
                objectId: nftObjectId,
                type: object.data.type,
                owner: object.data.owner,
                ...content?.fields,
            };
        } catch (error) {
            console.error('Error getting NFT info:', error);
            return null;
        }
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

            if (result.effects.status.status === 'success') {
                const returnValues = result.returnValues;
                if (returnValues && returnValues.length > 0) {
                    return Number(returnValues[0].value);
                }
            }
            return 0;
        } catch (error) {
            console.error('Error getting role:', error);
            return 0;
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
        if (!this.paymaster) {
            return {
                enabled: false,
                balance: '0',
                isHealthy: false,
            };
        }

        const balance = await this.paymaster.getPaymasterBalance();
        const hasBalance = await this.paymaster.checkPaymasterBalance();

        return {
            enabled: true,
            balance,
            isHealthy: hasBalance,
        };
    }
}

// Export singleton instance
let serviceInstance: BlockchainService | null = null;

export function getBlockchainService(): BlockchainService {
    if (!serviceInstance) {
        serviceInstance = new BlockchainService();
    }
    return serviceInstance;
}

export default BlockchainService;
