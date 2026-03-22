/**
 * Sui Blockchain Service
 * Handles all blockchain interactions for role management
 */

import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';
import { logger } from '@/lib/utils/logger';
import { getPackageId, getAdminCapObjectId, getContractObjectId } from './provider-sui';

class SuiService {
  private client: SuiClient;
  private packageId: string;
  private contractObjectId: string | null;
  private adminCapObjectId: string | null;
  private adminKeypair: Ed25519Keypair | null = null;
  private isInitialized: boolean = false;

  constructor() {
    const rpcUrl = process.env.NEXT_PUBLIC_SUI_RPC_URL || 'https://fullnode.devnet.sui.io:443';
    this.client = new SuiClient({ url: rpcUrl });
    // Use centralized utilities for configuration
    this.packageId = getPackageId() || '';
    this.contractObjectId = getContractObjectId();
    this.adminCapObjectId = getAdminCapObjectId();

    console.log('[SuiService] Initializing with:');
    console.log('[SuiService] - RPC URL:', rpcUrl);
    console.log('[SuiService] - Package ID:', this.packageId ? this.packageId.substring(0, 20) + '...' : 'NOT SET');

    // Hỗ trợ cả Bech32 (suiprivkey1...) và hex
    const adminPrivateKey =
      process.env.SUI_ADMIN_PRIVATE_KEY ||
      process.env.OWNER_PRIVATE_KEY;

    if (adminPrivateKey) {
      try {
        if (adminPrivateKey.startsWith('suiprivkey1')) {
          const { secretKey } = decodeSuiPrivateKey(adminPrivateKey);
          this.adminKeypair = Ed25519Keypair.fromSecretKey(secretKey);
        } else {
          this.adminKeypair = Ed25519Keypair.fromSecretKey(
            Buffer.from(adminPrivateKey.replace('0x', ''), 'hex')
          );
        }
        this.isInitialized = true;
        logger.info('sui-service', 'Admin keypair initialized successfully');
        console.log('[SuiService] Admin keypair initialized OK');
      } catch (error: any) {
        console.error('[SuiService] Failed to initialize admin keypair:', error.message);
        logger.error('sui-service', 'Failed to initialize admin keypair', error);
      }
    } else {
      console.warn('[SuiService] No private key found. Set SUI_ADMIN_PRIVATE_KEY or OWNER_PRIVATE_KEY');
    }
  }

  isReady(): boolean {
    return this.isInitialized && !!this.packageId && !!this.adminCapObjectId;
  }

  getStatus() {
    return {
      hasAdminKeypair: !!this.adminKeypair,
      hasPackageId: !!this.packageId,
      hasAdminCapObjectId: !!this.adminCapObjectId,
      isReady: this.isReady(),
      packageId: this.packageId,
      adminCapObjectId: this.adminCapObjectId,
      rpcUrl: process.env.NEXT_PUBLIC_SUI_RPC_URL || 'https://fullnode.devnet.sui.io:443',
    };
  }

  async grantRole(address: string, role: string, contractId?: string): Promise<string> {
    // Skip blockchain if FORCE_DB_ONLY is set
    if (process.env.FORCE_DB_ONLY === 'true') {
      console.log('[SuiService] ⚠️ FORCE_DB_ONLY enabled, skipping blockchain');
      return 'db-only-' + Date.now().toString();
    }

    if (!this.adminKeypair) {
      throw new Error('Admin keypair not configured. Set SUI_ADMIN_PRIVATE_KEY or OWNER_PRIVATE_KEY');
    }
    if (!this.packageId) {
      throw new Error('Package ID not configured. Set NEXT_PUBLIC_SUI_PACKAGE_ID or SUI_PACKAGE_ID');
    }
    if (!this.adminCapObjectId) {
      throw new Error('AdminCap Object ID not configured. Set SUI_ADMIN_CAP_OBJECT_ID');
    }

    const roleMap: Record<string, number> = {
      ADMIN: 4,
      MANUFACTURER: 1,
      DISTRIBUTOR: 2,
      PHARMACY: 3,
    };
    const roleId = roleMap[role];
    if (roleId === undefined) throw new Error('Invalid role: ' + role);

    console.log('[SuiService] grantRole:', { address, role, roleId, contractId, packageId: this.packageId, adminCapObjectId: this.adminCapObjectId });

    const tx = new TransactionBlock();

    // Use pharma_nft::assign_role - updates the PharmaNFTContract.roles table
    // Function signature: assign_role(contract, admin_cap, user, role, ctx)
    if (contractId && this.adminCapObjectId && this.packageId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const target: any = `${this.packageId}::pharma_nft::assign_role`;
      console.log('[SuiService] Calling function:', target);
      console.log('[SuiService] Arguments:', { contractId, adminCapObjectId: this.adminCapObjectId, address, roleId });

      tx.moveCall({
        target,
        arguments: [
          tx.object(contractId),
          tx.object(this.adminCapObjectId!),
          tx.pure(address),
          tx.pure(roleId),
        ],
      });
    } else {
      // Fallback: just create a dummy transaction (for devnet without contract object)
      console.log('[SuiService] ⚠️ Missing configuration, role stored in DB only');
      console.log('[SuiService] Missing:', { hasContractId: !!contractId, hasAdminCapObjectId: !!this.adminCapObjectId, hasPackageId: !!this.packageId });
      return 'db-only-' + Date.now().toString();
    }

    const result = await this.client.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      signer: this.adminKeypair,
      options: { showEffects: true, showObjectChanges: true },
    });

    if (result.effects?.status?.status !== 'success') {
      throw new Error('Transaction failed: ' + result.effects?.status?.error);
    }

    console.log('[SuiService] Role granted, tx:', result.digest);
    logger.info('sui-service', 'Role granted: ' + result.digest);
    return result.digest;
  }

  async revokeRole(address: string, role: string): Promise<string> {
    if (!this.adminKeypair) throw new Error('Admin keypair not configured');
    if (!this.packageId) throw new Error('Package ID not configured');
    if (!this.adminCapObjectId) throw new Error('AdminCap Object ID not configured');

    const contractObjectId = process.env.SUI_CONTRACT_OBJECT_ID || process.env.NEXT_PUBLIC_SUI_CONTRACT_OBJECT_ID;
    if (!contractObjectId) throw new Error('Contract Object ID not configured');

    const tx = new TransactionBlock();
    // Use pharma_nft::remove_role_by_admin(contract, user, ctx)
    // This requires sender to have ADMIN role (checked by the contract)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const targetRevoke: any = `${this.packageId}::pharma_nft::remove_role_by_admin`;
    tx.moveCall({
      target: targetRevoke,
      arguments: [
        tx.object(contractObjectId),
        tx.pure(address),
      ],
    });

    const result = await this.client.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      signer: this.adminKeypair,
      options: { showEffects: true },
    });

    if (result.effects?.status?.status !== 'success') {
      throw new Error('Transaction failed: ' + result.effects?.status?.error);
    }

    logger.info('sui-service', 'Role revoked: ' + result.digest);
    return result.digest;
  }

  async hasRole(address: string, role: string): Promise<boolean> {
    // Check role via dryRun on blockchain
    const roleMap: Record<string, number> = {
      ADMIN: 4,
      MANUFACTURER: 1,
      DISTRIBUTOR: 2,
      PHARMACY: 3,
    };
    const roleId = roleMap[role];
    if (roleId === undefined) return false;

    // Skip if contract not configured
    if (!this.contractObjectId || !this.packageId) {
      console.warn('[SuiService] Contract not configured, hasRole returning false');
      return false;
    }

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
      if (result.effects?.status?.status === 'success' && result.returnValues) {
        const actualRole = Number(result.returnValues[0]?.value || 0);
        return actualRole === roleId;
      }
    } catch (error) {
      console.error('[SuiService] hasRole error:', error);
    }
    return false;
  }
}

// Lazy initialization - only create instance when actually needed
let suiServiceInstance: SuiService | null = null;

export function getSuiService(): SuiService {
  if (!suiServiceInstance) {
    suiServiceInstance = new SuiService();
  }
  return suiServiceInstance;
}

// Backward compatibility - deprecated, use getSuiService() instead
export const suiService = new SuiService();
