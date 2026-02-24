/**
 * Paymaster Service
 * Enables gasless transactions for users by sponsoring gas fees
 */

import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { getSuiClient } from './provider-sui';
import { parsePrivateKey } from './contract-sui';
import { parseSuiError } from './errors-sui';

export interface PaymasterConfig {
    /** Minimum SUI balance required in paymaster wallet */
    minBalance: string;
    /** Maximum gas per transaction */
    maxGasLimit: number;
    /** Whitelisted contract methods that can use paymaster */
    whitelistedMethods: Set<string>;
    /** Rate limit per user (transactions per hour) */
    rateLimitPerUser: number;
    /** Cooldown period between transactions (ms) */
    cooldownMs: number;
}

export interface SponsoredTransaction {
    /** The transaction block to be signed */
    transaction: TransactionBlock;
    /** Paymaster's signature */
    sponsorSignature: string;
    /** Gas budget used */
    gasBudget: number;
    /** Gas price used */
    gasPrice: number;
}

export interface PaymasterStats {
    totalSponsored: number;
    totalGasUsed: string;
    activeUsers: number;
    lastRefill: Date;
}

export class PaymasterService {
    private client: SuiClient;
    private paymasterKeypair: Ed25519Keypair;
    private paymasterAddress: string;
    private config: PaymasterConfig;
    private userLastTx: Map<string, number>; // user address -> last transaction timestamp
    private userTxCount: Map<string, number>; // user address -> tx count in current window

    constructor(config?: Partial<PaymasterConfig>) {
        this.client = getSuiClient();

        // Initialize paymaster keypair from environment
        const privateKey = process.env.PAYMASTER_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('PAYMASTER_PRIVATE_KEY not configured');
        }

        this.paymasterKeypair = parsePrivateKey(privateKey);
        this.paymasterAddress = this.paymasterKeypair.toSuiAddress();

        // Default configuration
        this.config = {
            minBalance: '5000000000', // 5 SUI minimum
            maxGasLimit: 50000000, // 0.05 SUI max gas
            whitelistedMethods: new Set([
                'mint_nft',
                'transfer_nft',
                'update_status',
                'assign_role',
                'verify_participant',
            ]),
            rateLimitPerUser: 10, // 10 transactions per hour
            cooldownMs: 60000, // 1 minute cooldown
            ...config,
        };

        this.userLastTx = new Map();
        this.userTxCount = new Map();
    }

    /**
     * Check if paymaster wallet has sufficient balance
     */
    async checkPaymasterBalance(): Promise<boolean> {
        try {
            const balance = await this.client.getBalance({
                owner: this.paymasterAddress,
            });
            return BigInt(balance.totalBalance) >= BigInt(this.config.minBalance);
        } catch (error) {
            console.error('Error checking paymaster balance:', error);
            return false;
        }
    }

    /**
     * Get current paymaster balance
     */
    async getPaymasterBalance(): Promise<string> {
        try {
            const balance = await this.client.getBalance({
                owner: this.paymasterAddress,
            });
            return balance.totalBalance;
        } catch (error) {
            console.error('Error getting paymaster balance:', error);
            return '0';
        }
    }

    /**
     * Estimate gas for transaction
     */
    async estimateGas(txn: TransactionBlock): Promise<{
        gasBudget: number;
        gasPrice: number;
        totalGas: string;
    }> {
        try {
            const dryRun = await this.client.dryRunTransactionBlock({
                transactionBlock: await txn.build({ client: this.client }),
            });

            const effects = dryRun.effects;
            if (effects.status.status !== 'success') {
                throw new Error(`Transaction will fail: ${effects.status.error}`);
            }

            const gasBudget = Number(effects.gasUsed.computationCost) +
                             Number(effects.gasUsed.storageCost);
            const gasPrice = Number(dryRun.input.gasPrice);

            return {
                gasBudget,
                gasPrice,
                totalGas: effects.gasUsed.totalGas,
            };
        } catch (error) {
            console.error('Error estimating gas:', error);
            throw error;
        }
    }

    /**
     * Check if user is rate limited
     */
    isRateLimited(userAddress: string): {
        limited: boolean;
        reason?: string;
        retryAfter?: number;
    } {
        const now = Date.now();
        const lastTx = this.userLastTx.get(userAddress) || 0;
        const txCount = this.userTxCount.get(userAddress) || 0;

        // Check cooldown
        if (now - lastTx < this.config.cooldownMs) {
            return {
                limited: true,
                reason: 'Cooldown period active',
                retryAfter: this.config.cooldownMs - (now - lastTx),
            };
        }

        // Check rate limit
        if (txCount >= this.config.rateLimitPerUser) {
            return {
                limited: true,
                reason: 'Rate limit exceeded',
            };
        }

        return { limited: false };
    }

    /**
     * Validate transaction is whitelisted
     */
    isMethodWhitelisted(txn: TransactionBlock): {
        whitelisted: boolean;
        reason?: string;
    } {
        // Check if transaction contains only whitelisted calls
        const input = txn.blockData;
        if (!input || !input.transactions) {
            return { whitelisted: false, reason: 'Empty transaction' };
        }

        for (const tx of input.transactions) {
            if (tx.kind === 'MoveCalls') {
                const module = tx.target.split('::')[1];
                const method = tx.target.split('::')[2];

                // Only allow pharma_nft module calls
                if (module !== 'pharma_nft') {
                    return {
                        whitelisted: false,
                        reason: `Module ${module} not whitelisted`,
                    };
                }

                if (!this.config.whitelistedMethods.has(method)) {
                    return {
                        whitelisted: false,
                        reason: `Method ${method} not whitelisted`,
                    };
                }
            }
        }

        return { whitelisted: true };
    }

    /**
     * Create sponsored transaction
     * User signs the transaction, paymaster pays the gas
     */
    async createSponsoredTransaction(
        userAddress: string,
        transaction: TransactionBlock,
    ): Promise<SponsoredTransaction | { error: string }> {
        // 1. Check rate limits
        const rateLimit = this.isRateLimited(userAddress);
        if (rateLimit.limited) {
            return { error: `Rate limited: ${rateLimit.reason}` };
        }

        // 2. Validate transaction
        const whitelistCheck = this.isMethodWhitelisted(transaction);
        if (!whitelistCheck.whitelisted) {
            return { error: `Transaction not allowed: ${whitelistCheck.reason}` };
        }

        // 3. Check paymaster balance
        const hasBalance = await this.checkPaymasterBalance();
        if (!hasBalance) {
            return { error: 'Paymaster balance insufficient' };
        }

        // 4. Estimate gas
        let gasEstimate;
        try {
            gasEstimate = await this.estimateGas(transaction);
        } catch (error) {
            return { error: `Gas estimation failed: ${error}` };
        }

        // Cap gas limit
        const gasBudget = Math.min(gasEstimate.gasBudget, this.config.maxGasLimit);

        // 5. Set gas configuration
        transaction.setGasBudget(gasBudget);
        transaction.setGasPrice(gasEstimate.gasPrice);

        // 6. Sign with paymaster key
        try {
            const { signature } = await this.client.signTransactionBlock({
                signer: this.paymasterKeypair,
                transactionBlock: transaction,
            });

            return {
                transaction,
                sponsorSignature: signature,
                gasBudget,
                gasPrice: gasEstimate.gasPrice,
            };
        } catch (error) {
            return { error: `Paymaster signing failed: ${parseSuiError(error)}` };
        }
    }

    /**
     * Submit sponsored transaction
     */
    async submitSponsoredTransaction(
        sponsoredTx: SponsoredTransaction,
    ): Promise<{
        digest: string;
        success: boolean;
        error?: string;
    }> {
        try {
            const result = await this.client.executeTransactionBlock({
                transactionBlock: sponsoredTx.transaction,
                signature: sponsoredTx.sponsorSignature,
                options: {
                    showEffects: true,
                    showEvents: true,
                },
            });

            if (result.effects?.status?.status === 'success') {
                return {
                    digest: result.digest,
                    success: true,
                };
            } else {
                return {
                    digest: result.digest || '',
                    success: false,
                    error: result.effects?.status?.error || 'Transaction failed',
                };
            }
        } catch (error) {
            return {
                digest: '',
                success: false,
                error: parseSuiError(error),
            };
        }
    }

    /**
     * Complete flow: validate, sponsor, and submit
     * This is the main entry point for gasless transactions
     */
    async executeGaslessTransaction(
        userAddress: string,
        transaction: TransactionBlock,
    ): Promise<{
        digest: string;
        success: boolean;
        error?: string;
    }> {
        // Create sponsored transaction
        const sponsored = await this.createSponsoredTransaction(userAddress, transaction);
        if ('error' in sponsored) {
            return {
                digest: '',
                success: false,
                error: sponsored.error,
            };
        }

        // Submit
        const result = await this.submitSponsoredTransaction(sponsored);

        // Update rate limits
        if (result.success) {
            const now = Date.now();
            this.userLastTx.set(userAddress, now);
            this.userTxCount.set(
                userAddress,
                (this.userTxCount.get(userAddress) || 0) + 1
            );
        }

        return result;
    }

    /**
     * Get paymaster statistics
     */
    async getStats(): Promise<PaymasterStats> {
        const balance = await this.getPaymasterBalance();
        return {
            totalSponsored: this.userTxCount.size,
            totalGasUsed: balance, // Simplified - would track actual usage separately
            activeUsers: this.userLastTx.size,
            lastRefill: new Date(), // Would track actual refill time
        };
    }

    /**
     * Check if an address is whitelisted for free transactions
     */
    isWhitelisted(userAddress: string): boolean {
        // Could integrate with database or config
        const whitelist = process.env.PAYMASTER_WHITELIST?.split(',') || [];
        return whitelist.includes(userAddress);
    }

    /**
     * Add user to whitelist
     */
    addToWhitelist(userAddress: string): void {
        // Would update database or config
        console.log(`Added ${userAddress} to paymaster whitelist`);
    }

    /**
     * Remove user from whitelist
     */
    removeFromWhitelist(userAddress: string): void {
        // Would update database or config
        console.log(`Removed ${userAddress} from paymaster whitelist`);
    }
}

// Export singleton instance
let paymasterInstance: PaymasterService | null = null;

export function getPaymasterService(): PaymasterService {
    if (!paymasterInstance) {
        paymasterInstance = new PaymasterService();
    }
    return paymasterInstance;
}

export default PaymasterService;
