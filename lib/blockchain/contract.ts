/**
 * Blockchain Contract Interface
 * Re-exports all contract interaction functions for Sui blockchain
 */

// Export Sui functions
export * from './contract-sui';
export * from './provider-sui';
export * from './types-sui';
export * from './config-sui';

// Re-export with aliases for compatibility
export {
  getSuiRpcUrl as getRpcUrl,
  getSuiNetworkName as getNetworkName,
  getSuiExplorerTxUrl as getExplorerTxUrl,
  getSuiExplorerAddressUrl as getExplorerAddressUrl,
} from './config-sui';

export {
  getSuiClient as getRpcClient,
  checkSuiConnection as checkConnection,
  getSuiBalance as getGasBalance,
  checkObjectExists as checkContractExists,
} from './provider-sui';

export type {
  SuiTransactionResult as TransactionResult,
  SuiInvocationResult as InvocationResult,
  SuiTokenMetadata as TokenMetadata,
} from './types-sui';

// Re-export Role
export { Role } from './types-sui';
export { Role as ContractRole } from './types-sui';

// Helper function to get product NFT data (works for both)
import { getTokenProperties } from './contract-sui';
import { isProductExpired } from './contract-sui';

export interface ProductNFTData {
  owner: string;
  uri: string;
  batchNumber: string;
  expiryDate: number;
  isExpired: boolean;
  objectId?: string; // Sui object ID
}

export async function getProductNFTData(identifier: string | number): Promise<ProductNFTData> {
  const metadata = await getTokenProperties(String(identifier));
  if (!metadata) {
    throw new Error(`Token ${identifier} not found`);
  }
  
  const expired = await isProductExpired(String(identifier));
  
  return {
    owner: metadata.owner,
    uri: metadata.uri,
    batchNumber: metadata.batch_number,
    expiryDate: metadata.expiry_date,
    isExpired: expired,
    objectId: 'objectId' in metadata ? metadata.objectId : undefined,
  };
}
