/**
 * Blockchain Security Validator
 * Validates transactions for security concerns
 */

import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SuiClient } from '@mysten/sui.js/client';
import { getSuiRpcUrl } from './config-sui';

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    score: number; // 0-100 security score
}

export interface ValidationConfig {
    /** Maximum gas limit allowed */
    maxGasLimit: number;
    /** Maximum number of move calls per transaction */
    maxMoveCalls: number;
    /** Maximum transfer amount (for token transfers) */
    maxTransferAmount: number;
    /** Blacklisted addresses */
    blacklistedAddresses: Set<string>;
    /** Whitelisted contract addresses */
    whitelistedContracts: Set<string>;
    /** Allowed modules */
    allowedModules: Set<string>;
}

export class SecurityValidator {
    private client: SuiClient;
    private config: ValidationConfig;
    private knownSuspiciousPatterns: RegExp[] = [
        /transfer.*all/i,
        /panic/i,
        /assert.*false/i,
        /abort/i,
    ];

    constructor(config?: Partial<ValidationConfig>) {
        this.client = new SuiClient({ url: getSuiRpcUrl() });
        this.config = {
            maxGasLimit: 100000000, // 0.1 SUI max
            maxMoveCalls: 10,
            maxTransferAmount: 1000000000, // 1 SUI max
            blacklistedAddresses: new Set([
                '0x0000000000000000000000000000000000000000000000000000000000000000',
            ]),
            whitelistedContracts: new Set([
                '0x2', // Sui System
                '0x3', // Sui Clock
                '0x5', // Sui ID
            ]),
            allowedModules: new Set([
                'pharma_nft',
                'sui',
            ]),
            ...config,
        };
    }

    /**
     * Validate a transaction block
     */
    async validateTransaction(
        tx: TransactionBlock,
        sender: string
    ): Promise<ValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];
        let score = 100;

        try {
            const input = tx.blockData;

            // 1. Validate sender
            const senderValidation = this.validateSender(sender);
            if (!senderValidation.valid) {
                errors.push(...senderValidation.errors);
                score -= 30;
            }

            // 2. Validate gas budget
            const gasValidation = this.validateGas(input.gasData?.budget);
            if (!gasValidation.valid) {
                errors.push(...gasValidation.errors);
                score -= 20;
            } else if (gasValidation.warning) {
                warnings.push(gasValidation.warning);
                score -= 5;
            }

            // 3. Validate move calls
            const callsValidation = this.validateMoveCalls(input.transactions);
            if (!callsValidation.valid) {
                errors.push(...callsValidation.errors);
                score -= 25;
            } else if (callsValidation.warnings.length > 0) {
                warnings.push(...callsValidation.warnings);
                score -= 5;
            }

            // 4. Validate objects
            const objectsValidation = this.validateObjects(input.inputs);
            if (!objectsValidation.valid) {
                errors.push(...objectsValidation.errors);
                score -= 15;
            }

            // 5. Check for suspicious patterns
            const patternValidation = this.checkSuspiciousPatterns(input);
            if (patternValidation.found) {
                errors.push('Transaction contains suspicious patterns');
                score -= 50;
            }

            // 6. Validate timing (replay protection)
            const timingValidation = this.validateTiming();
            if (!timingValidation.valid) {
                errors.push(...timingValidation.errors);
                score -= 10;
            }

            return {
                valid: errors.length === 0,
                errors,
                warnings,
                score: Math.max(0, score),
            };
        } catch (error) {
            return {
                valid: false,
                errors: [`Validation error: ${error}`],
                warnings: [],
                score: 0,
            };
        }
    }

    private validateSender(sender: string): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!sender) {
            errors.push('Sender address is required');
            return { valid: false, errors };
        }

        if (!sender.startsWith('0x')) {
            errors.push('Invalid sender address format');
            return { valid: false, errors };
        }

        if (sender.length !== 66) {
            errors.push('Invalid sender address length');
            return { valid: false, errors };
        }

        if (this.config.blacklistedAddresses.has(sender)) {
            errors.push('Sender address is blacklisted');
            return { valid: false, errors };
        }

        return { valid: true, errors: [] };
    }

    private validateGas(
        gasBudget: number | undefined
    ): { valid: boolean; errors: string[]; warning?: string } {
        const errors: string[] = [];

        if (!gasBudget) {
            return { valid: true, errors: [], warning: 'No gas budget specified' };
        }

        if (gasBudget > this.config.maxGasLimit) {
            errors.push(`Gas limit ${gasBudget} exceeds maximum ${this.config.maxGasLimit}`);
            return { valid: false, errors };
        }

        if (gasBudget < 1000000) {
            return {
                valid: true,
                errors: [],
                warning: 'Gas budget is very low and may cause transaction to fail',
            };
        }

        return { valid: true, errors: [] };
    }

    private validateMoveCalls(transactions: any[]): {
        valid: boolean;
        errors: string[];
        warnings: string[];
    } {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!transactions) {
            return { valid: true, errors: [], warnings: [] };
        }

        // Count move calls
        const moveCalls = transactions.filter((tx) => tx.kind === 'MoveCalls');
        if (moveCalls.length > this.config.maxMoveCalls) {
            errors.push(
                `Too many move calls (${moveCalls.length}). Maximum allowed: ${this.config.maxMoveCalls}`
            );
            return { valid: false, errors, warnings };
        }

        // Validate each move call
        for (const call of moveCalls) {
            const target = call.target;
            if (!target) {
                errors.push('Move call has no target');
                continue;
            }

            const [packageId, module, functionName] = target.split('::');

            // Check if module is allowed
            if (!this.config.allowedModules.has(module)) {
                warnings.push(`Module ${module} is not in the standard whitelist`);
            }

            // Check for suspicious function names
            if (functionName.startsWith('_') || functionName.includes('$')) {
                warnings.push(`Function ${functionName} has unusual naming convention`);
            }

            // Validate arguments
            if (!call.arguments || !Array.isArray(call.arguments)) {
                errors.push(`Invalid arguments for ${functionName}`);
            }
        }

        return { valid: errors.length === 0, errors, warnings };
    }

    private validateObjects(inputs: any[]): {
        valid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (!inputs) {
            return { valid: true, errors: [] };
        }

        for (const input of inputs) {
            if (input.kind === 'Object') {
                const objectId = input.objectId;
                if (objectId && this.config.blacklistedAddresses.has(objectId)) {
                    errors.push('Transaction references a blacklisted object');
                }
            }
        }

        return { valid: errors.length === 0, errors };
    }

    private checkSuspiciousPatterns(input: any): { found: boolean } {
        // Convert transaction to string for pattern matching
        const txString = JSON.stringify(input);

        for (const pattern of this.knownSuspiciousPatterns) {
            if (pattern.test(txString)) {
                return { found: true };
            }
        }

        return { found: false };
    }

    private validateTiming(): {
        valid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        // Could add timestamp validation here
        // For example, check that transaction is not too old

        return { valid: true, errors: [] };
    }

    /**
     * Add address to blacklist
     */
    addToBlacklist(address: string): void {
        this.config.blacklistedAddresses.add(address.toLowerCase());
    }

    /**
     * Remove address from blacklist
     */
    removeFromBlacklist(address: string): void {
        this.config.blacklistedAddresses.delete(address.toLowerCase());
    }

    /**
     * Add module to whitelist
     */
    addAllowedModule(module: string): void {
        this.config.allowedModules.add(module);
    }

    /**
     * Remove module from whitelist
     */
    removeAllowedModule(module: string): void {
        this.config.allowedModules.delete(module);
    }

    /**
     * Get security report
     */
    getSecurityReport(): {
        blacklistedCount: number;
        whitelistedContractsCount: number;
        allowedModulesCount: number;
    } {
        return {
            blacklistedCount: this.config.blacklistedAddresses.size,
            whitelistedContractsCount: this.config.whitelistedContracts.size,
            allowedModulesCount: this.config.allowedModules.size,
        };
    }
}

// Export singleton
let validatorInstance: SecurityValidator | null = null;

export function getSecurityValidator(): SecurityValidator {
    if (!validatorInstance) {
        validatorInstance = new SecurityValidator();
    }
    return validatorInstance;
}

export default SecurityValidator;
