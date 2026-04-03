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
    this.packageId = getPackageId() || '';
    this.contractObjectId = getContractObjectId();
    this.adminCapObjectId = getAdminCapObjectId();

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
    if (process.env.FORCE_DB_ONLY === 'true') {
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

    const tx = new TransactionBlock();

    if (contractId && this.adminCapObjectId && this.packageId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const target: any = `${this.packageId}::pharma_nft::assign_role`;

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
    const roleMap: Record<string, number> = {
      ADMIN: 4,
      MANUFACTURER: 1,
      DISTRIBUTOR: 2,
      PHARMACY: 3,
    };
    const roleId = roleMap[role];
    if (roleId === undefined) return false;

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

let suiServiceInstance: SuiService | null = null;

export function getSuiService(): SuiService {
  if (!suiServiceInstance) {
    suiServiceInstance = new SuiService();
  }
  return suiServiceInstance;
}

export const suiService = new SuiService();
