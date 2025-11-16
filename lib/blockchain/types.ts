/**
 * TypeScript types for Neo N3 blockchain interactions
 */

import { UInt160 } from '@cityofzion/neon-core/lib/tx';

/**
 * Transaction result
 */
export interface TransactionResult {
  txHash: string;
  success: boolean;
  error?: string;
  blockNumber?: number;
  timestamp?: number;
}

/**
 * Contract invocation result
 */
export interface InvocationResult {
  success: boolean;
  result?: any;
  error?: string;
  txHash?: string;
}

/**
 * Token metadata
 */
export interface TokenMetadata {
  owner: string;
  uri: string;
  batch_number: string;
  expiry_date: number;
  expired: boolean;
}

/**
 * Role enum
 */
export enum Role {
  NONE = 0,
  MANUFACTURER = 1,
  DISTRIBUTOR = 2,
  PHARMACY = 3,
  ADMIN = 4,
}

/**
 * Role names mapping
 */
export const RoleNames: Record<Role, string> = {
  [Role.NONE]: 'None',
  [Role.MANUFACTURER]: 'Manufacturer',
  [Role.DISTRIBUTOR]: 'Distributor',
  [Role.PHARMACY]: 'Pharmacy',
  [Role.ADMIN]: 'Admin',
};

/**
 * Contract instance (legacy, kept for compatibility)
 */
export interface ContractInstance {
  address: string;
  abi?: any;
}
