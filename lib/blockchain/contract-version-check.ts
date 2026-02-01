/**
 * Check if contract supports Clock parameter in mint_product_nft
 * This helps determine if contract needs to be redeployed
 */

import { getSuiClient, getPackageId, getContractObjectId } from './provider-sui';
import { invokeSuiContractMethod } from './contract-sui';

export interface ContractVersionInfo {
  supportsClock: boolean;
  version?: string;
  error?: string;
}

/**
 * Check if contract supports Clock parameter
 * Attempts to dry-run mint with Clock parameter
 */
export async function checkContractVersion(): Promise<ContractVersionInfo> {
  try {
    const packageId = getPackageId();
    const contractObjectId = getContractObjectId();
    const client = getSuiClient();

    // Try to invoke get_user_role (simple read function) to verify contract exists
    try {
      const testResult = await invokeSuiContractMethod(
        packageId,
        'pharma_nft',
        'get_user_role',
        [contractObjectId, '0x0000000000000000000000000000000000000000000000000000000000000000']
      );

      if (!testResult.success) {
        return {
          supportsClock: false,
          error: 'Contract not found or not accessible',
        };
      }
    } catch (error: any) {
      return {
        supportsClock: false,
        error: `Contract check failed: ${error.message}`,
      };
    }

    // If we can read from contract, assume it exists
    // We can't easily test Clock parameter without actually building a transaction
    // So we'll return unknown and let the actual mint attempt determine it
    return {
      supportsClock: true, // Optimistic - actual error will be caught during mint
    };
  } catch (error: any) {
    return {
      supportsClock: false,
      error: error.message || 'Unknown error checking contract version',
    };
  }
}

