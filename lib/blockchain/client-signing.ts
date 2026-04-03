/**
 * Client-side signing utilities
 * Helper functions for signing transactions from frontend wallet
 */

import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SuiTransactionBlockResponse, SuiClient } from '@mysten/sui.js/client';
import { retryWithBackoff, parseError } from '@/lib/utils/error-handler';
import { getSuiRpcUrl } from './config-sui';

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
  to: string,
  sender: string
): Promise<BuildTransactionResponse> {
  try {
    const response = await fetch('/api/blockchain/build-transfer-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ objectId, to, sender }),
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
  sender: string,
  expiryDate?: number
): Promise<BuildTransactionResponse> {
  try {
    const response = await fetch('/api/blockchain/build-mint-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uri, batchNumber, sender, expiryDate }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      const errorMessage = data.detail || data.error || 'Failed to build transaction';
      const hint = data.hint || '';
      
      console.error('Build mint transaction failed:', {
        error: errorMessage,
        hint,
        status: response.status,
        data,
      });
      
      return {
        success: false,
        transactionBlock: new Uint8Array(),
        error: hint ? `${errorMessage}. ${hint}` : errorMessage,
      };
    }

    // Convert array back to Uint8Array
    return {
      success: true,
      transactionBlock: new Uint8Array(data.transactionBlock),
      message: data.message,
    };
  } catch (error: any) {
    console.error('Network error building mint transaction:', error);
    return {
      success: false,
      transactionBlock: new Uint8Array(),
      error: error.message || 'Network error. Please check your connection and try again.',
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
  sender: string,
  signAndExecuteTransactionBlock: (input: {
    transactionBlock: TransactionBlock | Uint8Array;
  }) => Promise<SuiTransactionBlockResponse>
): Promise<{ success: boolean; digest?: string; error?: string }> {
  // Step 1: Build transaction
  const buildResult = await buildTransferTransaction(objectId, to, sender);
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
 * Build mint transaction on client side (returns TransactionBlock object)
 */
function buildMintTransactionBlock(
  uri: string,
  batchNumber: string,
  sender: string,
  expiryDate: number | undefined
): { success: boolean; transactionBlock?: TransactionBlock; error?: string } {
  try {
    // Get package ID and contract object ID from environment (client-side)
    const packageId = process.env.NEXT_PUBLIC_SUI_PACKAGE_ID;
    const contractObjectId = process.env.NEXT_PUBLIC_SUI_CONTRACT_OBJECT_ID;

    if (!packageId || !contractObjectId) {
      return {
        success: false,
        error: 'Contract not configured. SUI_PACKAGE_ID or SUI_CONTRACT_OBJECT_ID not found.',
      };
    }

    // Default expiry date: 1 year from now (in milliseconds)
    const now = Date.now();
    const expiry = expiryDate || (now + (365 * 24 * 60 * 60 * 1000));
    
    // Validate expiry date is in the future
    if (expiry <= now) {
      return {
        success: false,
        error: 'Expiry date must be in the future',
      };
    }

    // Validate expiry date is not too far (max 10 years)
    const maxExpiry = now + (10 * 365 * 24 * 60 * 60 * 1000);
    if (expiry > maxExpiry) {
      return {
        success: false,
        error: 'Expiry date cannot be more than 10 years in the future',
      };
    }

    // Build transaction block on client
    const txb = new TransactionBlock();
    
    // Set sender address
    txb.setSender(sender);
    
    // Mint NFT - contract will transfer to caller automatically
    // Contract expects: contract, uri, batch_number, drug_name, description, expiry_date, quantity, clock
    txb.moveCall({
      target: `${packageId}::pharma_nft::mint_product_nft`,
      arguments: [
        txb.object(contractObjectId),    // contract: &mut PharmaNFTContract
        txb.pure(uri),                   // uri: String
        txb.pure(batchNumber),           // batch_number: String
        txb.pure(batchNumber),           // drug_name: String (use batchNumber as fallback)
        txb.pure(uri),                   // description: String (use uri as fallback)
        txb.pure(expiry, 'u64'),         // expiry_date: u64
        txb.pure(1, 'u64'),              // quantity: u64 (default 1)
        txb.object('0x6'),               // clock: &Clock
      ],
    });

    return {
      success: true,
      transactionBlock: txb,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to build transaction block',
    };
  }
}

/**
 * Complete flow: Build + Sign + Execute mint transaction
 */
export async function mintNFTWithWallet(
  uri: string,
  batchNumber: string,
  sender: string,
  expiryDate: number | undefined,
  signAndExecuteTransactionBlock: (input: {
    transactionBlock: TransactionBlock | Uint8Array;
  }) => Promise<SuiTransactionBlockResponse>
): Promise<{ success: boolean; digest?: string; error?: string }> {
  // Step 1: Build transaction block on client (returns TransactionBlock object, not Uint8Array)
  const buildResult = buildMintTransactionBlock(uri, batchNumber, sender, expiryDate);
  if (!buildResult.success || !buildResult.transactionBlock) {
    return {
      success: false,
      error: buildResult.error || 'Failed to build transaction',
    };
  }

  // Step 2: Sign and execute with TransactionBlock object (not Uint8Array)
  try {
    const result = await signAndExecuteTransactionBlock({
      transactionBlock: buildResult.transactionBlock,
    });

    return {
      success: true,
      digest: result.digest,
    };
  } catch (error: any) {
    const errorDetails = parseError(error);
    return {
      success: false,
      error: errorDetails.message,
    };
  }
}

