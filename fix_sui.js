const fs = require('fs');
const file = 'D:/Shared/New folder/Pharma_DNA_saga_2025/lib/blockchain/sui.service.ts';

const newContent = `/**
 * Sui Blockchain Service
 * Handles all blockchain interactions for role management
 */

import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';
import { logger } from '@/lib/utils/logger';

class SuiService {
  private client: SuiClient;
  private packageId: string;
  private adminKeypair: Ed25519Keypair | null = null;
  private isInitialized: boolean = false;

  constructor() {
    const rpcUrl = process.env.NEXT_PUBLIC_SUI_RPC_URL || 'https://fullnode.devnet.sui.io:443';
    this.client = new SuiClient({ url: rpcUrl });
    this.packageId = process.env.NEXT_PUBLIC_PHARMA_NFT_PACKAGE_ID || '';

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
    return this.isInitialized && !!this.packageId;
  }

  getStatus() {
    return {
      hasAdminKeypair: !!this.adminKeypair,
      hasPackageId: !!this.packageId,
      isReady: this.isInitialized && !!this.packageId,
      packageId: this.packageId,
      rpcUrl: process.env.NEXT_PUBLIC_SUI_RPC_URL || 'https://fullnode.devnet.sui.io:443',
    };
  }

  async grantRole(address: string, role: string): Promise<string> {
    if (!this.adminKeypair) {
      throw new Error('Admin keypair not configured. Set SUI_ADMIN_PRIVATE_KEY or OWNER_PRIVATE_KEY');
    }
    if (!this.packageId) {
      throw new Error('Package ID not configured. Set NEXT_PUBLIC_PHARMA_NFT_PACKAGE_ID');
    }

    const roleMap: Record<string, number> = {
      ADMIN: 0,
      MANUFACTURER: 1,
      DISTRIBUTOR: 2,
      PHARMACY: 3,
    };
    const roleId = roleMap[role];
    if (roleId === undefined) throw new Error('Invalid role: ' + role);

    console.log('[SuiService] grantRole:', { address, role, roleId });

    const tx = new TransactionBlock();
    const [nft] = tx.moveCall({
      target: this.packageId + '::main::mint',
      arguments: [
        tx.pure(roleId, 'u64'),
        tx.pure(0, 'u8'),
      ],
    });
    tx.transferObjects([nft], tx.pure(address));

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

    const roleMap: Record<string, number> = { ADMIN: 0, MANUFACTURER: 1, DISTRIBUTOR: 2, PHARMACY: 3 };
    const roleId = roleMap[role];

    const tx = new TransactionBlock();
    tx.moveCall({
      target: this.packageId + '::access_control::revoke_role',
      arguments: [tx.pure(address), tx.pure(roleId)],
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
    return true;
  }
}

export const suiService = new SuiService();
`;

fs.writeFileSync(file, newContent, 'utf8');
process.stdout.write('WRITTEN OK\n');
