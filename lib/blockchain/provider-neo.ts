/**
 * Neo N3 RPC Provider
 * Wrapper for Neo N3 RPC client with connection checks and utilities
 */

import { rpc, u } from '@cityofzion/neon-core';
import { getRpcUrl } from './config';

let rpcClientInstance: rpc.RPCClient | null = null;

/**
 * Get or create RPC client instance
 */
export function getRpcClient(): rpc.RPCClient {
  if (!rpcClientInstance) {
    const rpcUrl = getRpcUrl();
    rpcClientInstance = new rpc.RPCClient(rpcUrl);
  }
  return rpcClientInstance;
}

/**
 * Check RPC connection
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const client = getRpcClient();
    await client.getBlockCount();
    return true;
  } catch (error) {
    console.error('RPC connection failed:', error);
    return false;
  }
}

/**
 * Get block count
 */
export async function getBlockCount(): Promise<number> {
  const client = getRpcClient();
  return await client.getBlockCount();
}

/**
 * Get GAS balance for address
 */
export async function getGasBalance(address: string): Promise<string> {
  try {
    const client = getRpcClient();
    const balanceResult = await client.getNep17Balances(address);
    const balances = (balanceResult as any).balances || [];
    const gasBalance = balances.find((b: any) => b.asset_symbol === 'GAS');
    return gasBalance ? gasBalance.amount : '0';
  } catch (error) {
    console.error('Error getting GAS balance:', error);
    return '0';
  }
}

/**
 * Get NEO balance for address
 */
export async function getNeoBalance(address: string): Promise<string> {
  try {
    const client = getRpcClient();
    const balanceResult = await client.getNep17Balances(address);
    const balances = (balanceResult as any).balances || [];
    const neoBalance = balances.find((b: any) => b.asset_symbol === 'NEO');
    return neoBalance ? neoBalance.amount : '0';
  } catch (error) {
    console.error('Error getting NEO balance:', error);
    return '0';
  }
}

/**
 * Validate contract hash format
 */
export function validateContractHash(hash: string): boolean {
  if (!hash) return false;
  // Neo N3 contract hash is 40 hex characters (20 bytes) with optional 0x prefix
  const cleanHash = hash.startsWith('0x') ? hash.slice(2) : hash;
  return /^[0-9a-fA-F]{40}$/.test(cleanHash);
}

/**
 * Get contract hash from environment
 */
export function getContractHash(): string {
  const hash = process.env.NEO_CONTRACT_HASH || '';
  if (!hash) {
    throw new Error('NEO_CONTRACT_HASH not found in environment variables');
  }
  if (!validateContractHash(hash)) {
    throw new Error(`Invalid contract hash format: ${hash}`);
  }
  // Ensure 0x prefix
  return hash.startsWith('0x') ? hash : `0x${hash}`;
}

/**
 * Check if contract exists on blockchain
 */
export async function checkContractExists(contractHash: string): Promise<boolean> {
  try {
    const client = getRpcClient();
    const cleanHash = contractHash.startsWith('0x') ? contractHash.slice(2) : contractHash;
    const contract = await client.getContractState(cleanHash);
    return contract !== null && contract !== undefined;
  } catch (error) {
    return false;
  }
}

/**
 * Get transaction info
 */
export async function getTransactionInfo(txHash: string): Promise<any> {
  const client = getRpcClient();
  return await client.getTransaction(txHash);
}

/**
 * Get application log for transaction
 */
export async function getApplicationLog(txHash: string): Promise<any> {
  const client = getRpcClient();
  return await client.getApplicationLog(txHash);
}
