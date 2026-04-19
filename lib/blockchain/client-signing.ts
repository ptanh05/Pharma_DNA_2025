/**
 * Client-side signing utilities
 * Helper functions for signing transactions from frontend wallet
 */

import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SuiTransactionBlockResponse } from '@mysten/sui.js/client';
import { parseError } from '@/lib/utils/error-handler';
import { logger } from '@/lib/utils/logger';

export interface BuildTransactionResponse {
  success: boolean;
  transactionBlock: Uint8Array;
  message?: string;
  error?: string;
}

/**
 * Build transfer transaction (calls API endpoint)
 * NOTE: This builds on server and returns Uint8Array — used for server-side signing only.
 * For client-side wallet signing, use buildTransferTransactionBlock() instead.
 */
export async function buildTransferTransaction(
  objectId: string,
  to: string,
  sender: string
): Promise<BuildTransactionResponse> {
  try {
    const response = await fetch('/api/blockchain/build-transfer-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
 * Build transfer transaction block on client side (returns TransactionBlock object).
 * Used for wallet-based signing where user signs with their own private key.
 *
 * IMPORTANT: This MUST be signed by the NFT owner (sender), NOT the server keypair.
 */
export function buildTransferTransactionBlock(
  objectId: string,
  toAddress: string,
  sender: string
): { success: boolean; transactionBlock?: TransactionBlock; error?: string } {
  try {
    const packageId = process.env.NEXT_PUBLIC_SUI_PACKAGE_ID;
    const contractObjectId = process.env.NEXT_PUBLIC_SUI_CONTRACT_OBJECT_ID;

    if (!packageId || !contractObjectId) {
      return {
        success: false,
        error: 'Contract not configured. SUI_PACKAGE_ID or SUI_CONTRACT_OBJECT_ID not found.',
      };
    }

    // Validate objectId is a proper Sui address (0x...)
    if (!objectId.startsWith('0x')) {
      return {
        success: false,
        error: `Object ID "${objectId}" không hợp lệ. Cần là địa chỉ Sui (0x...).`,
      };
    }

    const txb = new TransactionBlock();
    // sender must be the NFT owner — wallet extension will sign with this key
    txb.setSender(sender);

    txb.moveCall({
      target: `${packageId}::pharma_nft::transfer_product_nft`,
      arguments: [
        txb.object(objectId),               // NFT object owned by sender
        txb.object(contractObjectId),        // PharmaNFTContract share object
        txb.pure(toAddress, 'address'),      // Recipient address
        txb.object('0x6'),                   // Clock object
      ],
    });

    return { success: true, transactionBlock: txb };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to build transaction block',
    };
  }
}

/**
 * Transfer NFT using client's wallet (user signs with their own key).
 * User's wallet signs → Sui verifies sender == NFT owner → transaction succeeds.
 *
 * @param objectId    - Sui object ID of the NFT (must start with 0x)
 * @param toAddress   - Recipient Sui address
 * @param sender      - NFT owner's address (used as transaction sender)
 * @param signAndExecuteTransactionBlock - Wallet hook function
 */
export async function transferNFTWithWallet(
  objectId: string,
  toAddress: string,
  sender: string,
  signAndExecuteTransactionBlock: (input: {
    transactionBlock: TransactionBlock | Uint8Array;
  }) => Promise<SuiTransactionBlockResponse>
): Promise<{ success: boolean; digest?: string; error?: string }> {
  // Build transaction block — sender will sign with their wallet
  const buildResult = buildTransferTransactionBlock(objectId, toAddress, sender);
  if (!buildResult.success || !buildResult.transactionBlock) {
    return {
      success: false,
      error: buildResult.error || 'Failed to build transaction',
    };
  }

  // User signs with wallet → Sui verifies sender == NFT owner
  try {
    const result = await signAndExecuteTransactionBlock({
      transactionBlock: buildResult.transactionBlock,
    });
    return { success: true, digest: result.digest };
  } catch (error: any) {
    const errorDetails = parseError(error);
    return { success: false, error: errorDetails.message };
  }
}

/**
 * Build mint transaction (calls API endpoint — server-side signing)
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uri, batchNumber, sender, expiryDate }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.detail || data.error || 'Failed to build transaction';
      const hint = data.hint || '';

      logger.error('BLOCKCHAIN_SIGNING', 'Build mint transaction failed', {
        error: errorMessage,
        hint,
        status: response.status,
      });

      return {
        success: false,
        transactionBlock: new Uint8Array(),
        error: hint ? `${errorMessage}. ${hint}` : errorMessage,
      };
    }

    return {
      success: true,
      transactionBlock: new Uint8Array(data.transactionBlock),
      message: data.message,
    };
  } catch (error: any) {
    logger.error('BLOCKCHAIN_SIGNING', 'Network error building mint transaction', error);
    return {
      success: false,
      transactionBlock: new Uint8Array(),
      error: error.message || 'Network error. Please check your connection and try again.',
    };
  }
}

/**
 * Execute signed transaction (server-side signing, used by executeTransaction)
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
      return await signAndExecuteTransactionBlock({ transactionBlock });
    };

    const result = retry
      ? await executeWithRetry(executeFn, 2, 1000)
      : await executeFn();

    return { success: true, digest: result.digest };
  } catch (error: any) {
    const errorDetails = parseError(error);
    return {
      success: false,
      error: errorDetails.message,
      userMessage: errorDetails.userMessage,
    };
  }
}

async function executeWithRetry(
  fn: () => Promise<SuiTransactionBlockResponse>,
  maxRetries: number,
  initialDelayMs: number
): Promise<SuiTransactionBlockResponse> {
  let lastError: any;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (i < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, initialDelayMs * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}

/**
 * Build mint transaction block on client side (returns TransactionBlock object)
 */
function buildMintTransactionBlock(
  uri: string,
  batchNumber: string,
  sender: string,
  expiryDate: number | undefined
): { success: boolean; transactionBlock?: TransactionBlock; error?: string } {
  try {
    const packageId = process.env.NEXT_PUBLIC_SUI_PACKAGE_ID;
    const contractObjectId = process.env.NEXT_PUBLIC_SUI_CONTRACT_OBJECT_ID;

    if (!packageId || !contractObjectId) {
      return {
        success: false,
        error: 'Contract not configured. SUI_PACKAGE_ID or SUI_CONTRACT_OBJECT_ID not found.',
      };
    }

    const now = Date.now();
    const expiry = expiryDate || (now + 365 * 24 * 60 * 60 * 1000);

    if (expiry <= now) {
      return { success: false, error: 'Expiry date must be in the future' };
    }
    if (expiry > now + 10 * 365 * 24 * 60 * 60 * 1000) {
      return { success: false, error: 'Expiry date cannot be more than 10 years in the future' };
    }

    const txb = new TransactionBlock();
    txb.setSender(sender);

    txb.moveCall({
      target: `${packageId}::pharma_nft::mint_product_nft`,
      arguments: [
        txb.object(contractObjectId),
        txb.pure(uri),
        txb.pure(batchNumber),
        txb.pure(batchNumber),
        txb.pure(uri),
        txb.pure(expiry, 'u64'),
        txb.pure(1, 'u64'),
        txb.object('0x6'),
      ],
    });

    return { success: true, transactionBlock: txb };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to build transaction block',
    };
  }
}

/**
 * Complete flow: Build + Sign + Execute mint transaction (wallet signing)
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
  const buildResult = buildMintTransactionBlock(uri, batchNumber, sender, expiryDate);
  if (!buildResult.success || !buildResult.transactionBlock) {
    return {
      success: false,
      error: buildResult.error || 'Failed to build transaction',
    };
  }

  try {
    const result = await signAndExecuteTransactionBlock({
      transactionBlock: buildResult.transactionBlock,
    });
    return { success: true, digest: result.digest };
  } catch (error: any) {
    const errorDetails = parseError(error);
    return { success: false, error: errorDetails.message };
  }
}