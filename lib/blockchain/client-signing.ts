/**
 * Client-side signing utilities
 * Helper functions for signing transactions from frontend wallet
 */

import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SuiTransactionBlockResponse } from '@mysten/sui.js/client';
import { retryWithBackoff, parseError } from '@/lib/utils/error-handler';

export interface BuildTransactionResponse {
  success: boolean;
  transactionBlock: Uint8Array;
  message?: string;
  error?: string;
}

/**
 * Build transfer transaction (call API)
 */
export async function buildTransferTransaction(
  objectId: string,
  to: string
): Promise<BuildTransactionResponse> {
  try {
    const response = await fetch('/api/blockchain/build-transfer-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ objectId, to }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        transactionBlock: new Uint8Array(),
        error: data.error || 'Failed to build transaction',
      };
    }

    // Convert array back to Uint8Array
    return {
      success: true,
      transactionBlock: new Uint8Array(data.transactionBlock),
      message: data.message,
    };
  } catch (error: any) {
    return {
      success: false,
      transactionBlock: new Uint8Array(),
      error: error.message || 'Network error',
    };
  }
}

/**
 * Build mint transaction (call API)
 */
export async function buildMintTransaction(
  uri: string,
  batchNumber: string,
  expiryDate?: number
): Promise<BuildTransactionResponse> {
  try {
    const response = await fetch('/api/blockchain/build-mint-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uri, batchNumber, expiryDate }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        transactionBlock: new Uint8Array(),
        error: data.error || 'Failed to build transaction',
      };
    }

    // Convert array back to Uint8Array
    return {
      success: true,
      transactionBlock: new Uint8Array(data.transactionBlock),
      message: data.message,
    };
  } catch (error: any) {
    return {
      success: false,
      transactionBlock: new Uint8Array(),
      error: error.message || 'Network error',
    };
  }
}

/**
 * Execute signed transaction with retry logic
 * @param transactionBlock - Transaction block bytes (Uint8Array)
 * @param signAndExecuteTransactionBlock - Function from useWalletSui hook
 * @param retry - Whether to retry on failure (default: false for user actions)
 */
export async function executeTransaction(
  transactionBlock: Uint8Array,
  signAndExecuteTransactionBlock: (input: {
    transactionBlock: TransactionBlock | Uint8Array;
  }) => Promise<SuiTransactionBlockResponse>,
  retry: boolean = false
): Promise<{ success: boolean; digest?: string; error?: string; userMessage?: string }> {
  try {
    const executeFn = async () => {
      return await signAndExecuteTransactionBlock({
        transactionBlock,
      });
    };

    // Retry only for network errors, not for user rejections
    const result = retry
      ? await retryWithBackoff(executeFn, 2, 1000) // Max 2 retries, 1s initial delay
      : await executeFn();

    return {
      success: true,
      digest: result.digest,
    };
  } catch (error: any) {
    const errorDetails = parseError(error);
    return {
      success: false,
      error: errorDetails.message,
      userMessage: errorDetails.userMessage,
    };
  }
}

/**
 * Complete flow: Build + Sign + Execute transfer transaction
 */
export async function transferNFTWithWallet(
  objectId: string,
  to: string,
  signAndExecuteTransactionBlock: (input: {
    transactionBlock: TransactionBlock | Uint8Array;
  }) => Promise<SuiTransactionBlockResponse>
): Promise<{ success: boolean; digest?: string; error?: string }> {
  // Step 1: Build transaction
  const buildResult = await buildTransferTransaction(objectId, to);
  if (!buildResult.success) {
    return {
      success: false,
      error: buildResult.error || 'Failed to build transaction',
    };
  }

  // Step 2: Sign and execute
  return await executeTransaction(buildResult.transactionBlock, signAndExecuteTransactionBlock);
}

/**
 * Complete flow: Build + Sign + Execute mint transaction
 */
export async function mintNFTWithWallet(
  uri: string,
  batchNumber: string,
  expiryDate: number | undefined,
  signAndExecuteTransactionBlock: (input: {
    transactionBlock: TransactionBlock | Uint8Array;
  }) => Promise<SuiTransactionBlockResponse>
): Promise<{ success: boolean; digest?: string; error?: string }> {
  // Step 1: Build transaction
  const buildResult = await buildMintTransaction(uri, batchNumber, expiryDate);
  if (!buildResult.success) {
    return {
      success: false,
      error: buildResult.error || 'Failed to build transaction',
    };
  }

  // Step 2: Sign and execute
  return await executeTransaction(buildResult.transactionBlock, signAndExecuteTransactionBlock);
}

