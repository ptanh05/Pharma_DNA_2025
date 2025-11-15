/**
 * TypeScript types for PharmaNFT Contract
 */

import { UInt160 } from '@cityofzion/neon-core';

export interface ProductNFTData {
  tokenId: number;
  owner: string;
  uri: string;
  batchNumber: string;
  expiryDate: number;
  expired: boolean;
  history: string[];
}

export interface ContractStatistics {
  totalMinted: number;
  totalTransferred: number;
  nextTokenId: number;
}

export interface RoleInfo {
  address: string;
  role: number;
  roleName: string;
}

export interface TransferRestriction {
  fromRole: number;
  toRole: number;
  allowed: boolean;
}

export interface ContractConfig {
  contractHash: string;
  rpcUrl: string;
  networkMagic: number;
  explorer: string;
}

export type ContractRole = 0 | 1 | 2 | 3 | 4;

export const ROLE_STRING_TO_ENUM: Record<string, ContractRole> = {
  'NONE': 0,
  'MANUFACTURER': 1,
  'DISTRIBUTOR': 2,
  'PHARMACY': 3,
  'ADMIN': 4,
};

export const ROLE_ENUM_TO_STRING: Record<ContractRole, string> = {
  0: 'NONE',
  1: 'MANUFACTURER',
  2: 'DISTRIBUTOR',
  3: 'PHARMACY',
  4: 'ADMIN',
};

