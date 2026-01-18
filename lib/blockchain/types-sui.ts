/**
 * TypeScript types for Sui blockchain interactions
 */

/**
 * Transaction result
 */
export interface SuiTransactionResult {
  digest: string;
  success: boolean;
  error?: string;
  checkpoint?: number;
  timestamp?: number;
}

/**
 * Contract invocation result
 */
export interface SuiInvocationResult {
  success: boolean;
  result?: any;
  error?: string;
  digest?: string;
}

/**
 * Token metadata (for Sui objects)
 */
export interface SuiTokenMetadata {
  owner: string;
  objectId: string;
  uri: string;
  batch_number: string;
  expiry_date: number;
  expired: boolean;
  type: string;
}

/**
 * Role enum for Sui blockchain
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
 * Sui Object Info
 */
export interface SuiObjectInfo {
  objectId: string;
  type: string;
  owner: string | null;
  version: string;
  digest: string;
}

/**
 * Sui Transaction Block
 */
export interface SuiTransactionBlock {
  digest: string;
  transaction: any;
  effects: any;
  events?: any[];
  timestampMs?: string;
  checkpoint?: number;
}

