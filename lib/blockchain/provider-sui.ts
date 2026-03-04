/**
 * Sui RPC Provider
 * Wrapper for Sui RPC client with connection checks and utilities
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { getSuiRpcUrl } from './config-sui';

let suiClientInstance: SuiClient | null = null;

/**
 * Get or create Sui client instance
 */
export function getSuiClient(): SuiClient {
  if (!suiClientInstance) {
    const rpcUrl = getSuiRpcUrl();
    suiClientInstance = new SuiClient({ url: rpcUrl });
  }
  return suiClientInstance;
}

/**
 * Check RPC connection
 */
export async function checkSuiConnection(): Promise<boolean> {
  try {
    const client = getSuiClient();
    await client.getLatestSuiSystemState();
    return true;
  } catch (error) {
    console.error('Sui RPC connection failed:', error);
    return false;
  }
}

/**
 * Get latest checkpoint
 */
export async function getLatestCheckpoint(): Promise<number> {
  const client = getSuiClient();
  const checkpoint = await client.getLatestCheckpointSequenceNumber();
  return Number(checkpoint);
}

/**
 * Get SUI balance for address
 */
export async function getSuiBalance(address: string): Promise<string> {
  try {
    const client = getSuiClient();
    const balance = await client.getBalance({
      owner: address,
    });
    return balance.totalBalance;
  } catch (error) {
    console.error('Error getting SUI balance:', error);
    return '0';
  }
}

/**
 * Validate Sui address format
 */
export function validateSuiAddress(address: string): boolean {
  if (!address) return false;
  // Sui address is base58 encoded, typically 32-44 characters
  // Format: starts with 0x and is 66 hex characters (33 bytes)
  if (address.startsWith('0x')) {
    const hexPart = address.slice(2);
    return /^[0-9a-fA-F]{64}$/.test(hexPart);
  }
  return false;
}

/**
 * Get package ID from environment
 */
export function getPackageId(): string {
  const packageId = process.env.SUI_PACKAGE_ID || process.env.NEXT_PUBLIC_SUI_PACKAGE_ID || '';
  if (!packageId) {
    throw new Error('SUI_PACKAGE_ID not found in environment variables');
  }
  if (!validateSuiAddress(packageId)) {
    throw new Error(`Invalid package ID format: ${packageId}`);
  }
  // Ensure 0x prefix
  return packageId.startsWith('0x') ? packageId : `0x${packageId}`;
}

/**
 * Get contract object ID from environment
 */
export function getContractObjectId(): string {
  const objectId = process.env.SUI_CONTRACT_OBJECT_ID || process.env.NEXT_PUBLIC_SUI_CONTRACT_OBJECT_ID || '';
  if (!objectId) {
    throw new Error('SUI_CONTRACT_OBJECT_ID not found in environment variables');
  }
  if (!validateSuiAddress(objectId)) {
    throw new Error(`Invalid contract object ID format: ${objectId}`);
  }
  return objectId.startsWith('0x') ? objectId : `0x${objectId}`;
}

/**
 * Get AdminCap object ID from environment
 */
export function getAdminCapObjectId(): string {
  const objectId = process.env.SUI_ADMIN_CAP_OBJECT_ID || '';
  if (!objectId) {
    throw new Error('SUI_ADMIN_CAP_OBJECT_ID not found in environment variables');
  }
  if (!validateSuiAddress(objectId)) {
    throw new Error(`Invalid AdminCap object ID format: ${objectId}`);
  }
  return objectId.startsWith('0x') ? objectId : `0x${objectId}`;
}

/**
 * Check if object exists on blockchain
 */
export async function checkObjectExists(objectId: string): Promise<boolean> {
  try {
    const client = getSuiClient();
    const object = await client.getObject({
      id: objectId,
      options: {
        showType: true,
        showOwner: true,
      },
    });
    return object !== null && object.data !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Get transaction info
 */
export async function getTransactionInfo(txDigest: string): Promise<any> {
  const client = getSuiClient();
  return await client.getTransactionBlock({
    digest: txDigest,
    options: {
      showInput: true,
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
      showBalanceChanges: true,
    },
  });
}

/**
 * Get object details
 */
export async function getObjectDetails(objectId: string): Promise<any> {
  const client = getSuiClient();
  return await client.getObject({
    id: objectId,
    options: {
      showType: true,
      showOwner: true,
      showPreviousTransaction: true,
      showDisplay: true,
      showContent: true,
      showBcs: true,
      showStorageRebate: true,
    },
  });
}

