/**
 * Blockchain Contract Interface
 * Re-exports all contract interaction functions
 */

export * from './contract-neo';
export * from './provider-neo';
export * from './types';

// Re-export Role as ContractRole for backward compatibility
export { Role as ContractRole } from './types';

// Helper function to get product NFT data (alias for getTokenProperties)
import { getTokenProperties, TokenMetadata } from './contract-neo';
import { isProductExpired } from './contract-neo';

export interface ProductNFTData {
  owner: string;
  uri: string;
  batchNumber: string;
  expiryDate: number;
  isExpired: boolean;
}

export async function getProductNFTData(tokenId: number): Promise<ProductNFTData> {
  const metadata = await getTokenProperties(tokenId);
  if (!metadata) {
    throw new Error(`Token ${tokenId} not found`);
  }
  
  const expired = await isProductExpired(tokenId);
  
  return {
    owner: metadata.owner,
    uri: metadata.uri,
    batchNumber: metadata.batch_number,
    expiryDate: metadata.expiry_date,
    isExpired: expired,
  };
}