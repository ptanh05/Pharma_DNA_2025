/**
 * Sui Contract Interaction
 * Functions to interact with PharmaNFT smart contract on Sui
 */

import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { bech32 } from 'bech32';
import { getSuiRpcUrl, getSuiExplorerTxUrl } from './config-sui';
import { getSuiClient, getPackageId, getContractObjectId, getAdminCapObjectId, checkObjectExists } from './provider-sui';
import { SuiTransactionResult, SuiInvocationResult, Role, SuiTokenMetadata } from './types-sui';
import { parseSuiError, isRetryableError } from './errors-sui';
import { logger } from '@/lib/utils/logger';

/**
 * Get package ID from environment
 */
export function getPackageIdFromEnv(): string {
  return getPackageId() ?? '';
}

/**
 * Get contract object ID from environment
 */
export function getContractObjectIdFromEnv(): string {
  return getContractObjectId() ?? '';
}

/**
 * Parse private key to Ed25519Keypair
 * Supports multiple formats: bech32, hex (0x or raw), base64
 */
export function parsePrivateKey(privateKey: string): Ed25519Keypair {
  if (!privateKey || typeof privateKey !== 'string') {
    throw new Error('Private key must be a non-empty string');
  }

  const trimmedKey = privateKey.trim();

  try {
    // Check if it's bech32 format (suiprivkey1...)
    if (trimmedKey.startsWith('suiprivkey1')) {
      // Decode bech32 to get raw bytes
      const decoded = bech32.decode(trimmedKey);
      const privateKeyBytes = Uint8Array.from(bech32.fromWords(decoded.words));
      // Sui private key is 32 bytes, but bech32 might include version byte
      // Take the last 32 bytes if longer
      const keyBytes = privateKeyBytes.length > 32 
        ? privateKeyBytes.slice(-32) 
        : privateKeyBytes;
      
      if (keyBytes.length !== 32) {
        throw new Error(`Invalid bech32 private key length: ${keyBytes.length}, expected 32 bytes`);
      }
      
      return Ed25519Keypair.fromSecretKey(keyBytes);
    }
    
    // Check if it's hex format with 0x prefix
    if (trimmedKey.startsWith('0x')) {
      const hexPart = trimmedKey.slice(2);
      if (!/^[0-9a-fA-F]+$/.test(hexPart)) {
        throw new Error('Invalid hex format in 0x-prefixed private key');
      }
      
      // Hex can be 64 chars (32 bytes) or 128 chars (64 bytes for keypair)
      // For Ed25519, we need exactly 32 bytes (64 hex chars)
      if (hexPart.length === 64) {
        const privateKeyBytes = Uint8Array.from(Buffer.from(hexPart, 'hex'));
        if (privateKeyBytes.length !== 32) {
          throw new Error(`Invalid hex private key length: ${privateKeyBytes.length}, expected 32 bytes`);
        }
        return Ed25519Keypair.fromSecretKey(privateKeyBytes);
      } else if (hexPart.length === 128) {
        // 64 bytes = 32 bytes private key + 32 bytes public key
        // Take first 32 bytes as private key
        const privateKeyBytes = Uint8Array.from(Buffer.from(hexPart.slice(0, 64), 'hex'));
        return Ed25519Keypair.fromSecretKey(privateKeyBytes);
      } else {
        throw new Error(`Invalid hex private key length: ${hexPart.length} chars, expected 64 or 128 chars`);
      }
    }
    
    // Check if it's raw hex string (64 chars = 32 bytes)
    if (trimmedKey.length === 64 && /^[0-9a-fA-F]+$/.test(trimmedKey)) {
      const privateKeyBytes = Uint8Array.from(Buffer.from(trimmedKey, 'hex'));
      if (privateKeyBytes.length !== 32) {
        throw new Error(`Invalid hex private key length: ${privateKeyBytes.length}, expected 32 bytes`);
      }
      return Ed25519Keypair.fromSecretKey(privateKeyBytes);
    }
    
    // Try base64
    try {
      const privateKeyBytes = Uint8Array.from(Buffer.from(trimmedKey, 'base64'));
      
      // Base64 can encode different lengths, but we need exactly 32 bytes
      // If it's longer, it might be a keypair (64 bytes) or have extra data
      if (privateKeyBytes.length === 32) {
        return Ed25519Keypair.fromSecretKey(privateKeyBytes);
      } else if (privateKeyBytes.length === 64) {
        // 64 bytes = 32 bytes private key + 32 bytes public key
        // Take first 32 bytes as private key
        return Ed25519Keypair.fromSecretKey(privateKeyBytes.slice(0, 32));
      } else if (privateKeyBytes.length > 32) {
        // Take last 32 bytes if longer
        return Ed25519Keypair.fromSecretKey(privateKeyBytes.slice(-32));
      } else {
        throw new Error(`Invalid base64 private key length: ${privateKeyBytes.length} bytes, expected 32 bytes`);
      }
    } catch (base64Error: any) {
      // If base64 decode fails, try other formats
      throw new Error(`Failed to parse private key. Tried bech32, hex, and base64 formats. Error: ${base64Error.message}`);
    }
  } catch (error: any) {
    if (error.message.includes('Invalid private key format') || error.message.includes('Failed to parse')) {
      throw error;
    }
    throw new Error(`Invalid private key format: ${error.message || error}`);
  }
}

/**
 * Sign and send transaction with retry logic for network errors
 */
export async function signAndSendTransaction(
  txb: TransactionBlock,
  privateKey: string,
  maxRetries: number = 3
): Promise<SuiTransactionResult> {
  // Create keypair from private key using helper function
  let keypair: Ed25519Keypair;
  try {
    keypair = parsePrivateKey(privateKey);
  } catch (error: any) {
    throw new Error(`Invalid private key format: ${error.message || error}`);
  }

  // Set sender address (required for transaction)
  const senderAddress = keypair.toSuiAddress();
  txb.setSender(senderAddress);

  // Ensure gas budget is set BEFORE build (avoids "could not automatically determine a budget" dry run failure)
  // Only set if not already configured — use a generous budget for complex transactions
  const gasConfig = (txb as any).blockData?.gasConfig;
  const hasBudget = gasConfig && typeof gasConfig === 'object' && Number(gasConfig.budget ?? 0) > 0;
  if (!hasBudget) {
    txb.setGasBudget(200000000); // 0.2 SUI — generous budget for transactions with tables/vectors
  }

  // Get client once (used for both execution and build)
  const client = getSuiClient();

  // Retry loop for network/RPC errors
  let lastError: string = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Sign and execute transaction
      const result = await client.signAndExecuteTransactionBlock({
        signer: keypair,
        transactionBlock: txb,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
          showInput: true,
        },
      });


      if (result.effects?.status?.status === 'success') {
        return {
          digest: result.digest,
          success: true,
          checkpoint: Number(result.checkpoint || 0),
        };
      } else {
        // Extract detailed error information
        const errorDetails = result.effects?.status?.error || 'Transaction failed';
        let errorMessage = '';

        if (typeof errorDetails === 'string') {
          errorMessage = errorDetails;
        } else if (errorDetails) {
          const err = errorDetails as { message?: string; code?: number };
          if (err.message) {
            errorMessage = err.message;
          } else if (err.code) {
            errorMessage = `Error code ${err.code}: ${JSON.stringify(errorDetails)}`;
          } else {
            errorMessage = JSON.stringify(errorDetails);
          }
        }

        logger.error('SIGN_AND_SEND', 'Transaction failed', {
          digest: result.digest,
          error: errorMessage,
          fullError: errorDetails,
        });

        return {
          digest: result.digest || '',
          success: false,
          error: errorMessage || 'Transaction failed',
        };
      }
    } catch (txError: any) {
      // Try to unwrap MoveAbort that may be hidden inside "could not determine budget" dry-run error
      const dryRunWrapper = parseSuiError(txError);
      let unwrappedError = dryRunWrapper;

      // Cast to any to access dynamic Sui SDK error properties
      const err = txError as any;

      // The Sui SDK >= 0.44 wraps MoveAbort inside the "could not determine budget" message
      // Check multiple possible locations for MoveAbort (SDK version differences):
      const txBlock = err?.transactionBlock;
      const confirmation = err?.confirmation;
      const effects = err?.effects;
      const lc = confirmation?.liquidCrystal;

      // Sui SDK 0.44+: MoveAbort may be at err.digest.confirmation.liquidCrystal.effects.status.error
      if (lc?.effects?.status?.error) {
        const effErr = lc.effects.status.error;
        if (typeof effErr === 'string' && effErr.includes('MoveAbort')) {
          unwrappedError = effErr;
        }
      }

      // Fallback: err.transactionBlock.Failure (SDK < 0.44 or different structure)
      if (unwrappedError === dryRunWrapper && txBlock?.Failure?.MoveAbort) {
        const failure = txBlock.Failure;
        const { location, abort_code } = failure.MoveAbort;
        const code = typeof abort_code === 'bigint' ? Number(abort_code) : abort_code;
        const addr = location?.Module?.address || location?.address || '';
        unwrappedError = `MoveAbort(code=${code}) at ${addr}::${location?.Module?.name || 'unknown'}::${failure.MoveAbort.function_name || 'unknown'}`;
      }

      // err.effects.status.error directly
      if (unwrappedError === dryRunWrapper && effects?.status?.error) {
        const effErr = effects.status.error;
        if (typeof effErr === 'string') {
          unwrappedError = effErr;
        } else if (effErr?.message) {
          unwrappedError = effErr.message;
        }
      }

      // Replace wrapper with real abort code for all MoveAbort cases in this wrapper
      const parsedError = dryRunWrapper !== unwrappedError
        ? unwrappedError
        : parseSuiError(txError);

      logger.error('SIGN_AND_SEND', `Attempt ${attempt} failed`, parsedError);

      // Check if error is retryable
      if (!isRetryableError(txError)) {
        // Non-retryable error (e.g., invalid private key, bad transaction, MoveAbort from contract)
        // MoveAbort = contract-level error (validation failed) — retrying won't help
        const isMoveAbort =
          parsedError.includes('MoveAbort') ||
          parsedError.includes('MoveLocation') ||
          dryRunWrapper.includes('MoveAbort');

        if (isMoveAbort) {
          return {
            digest: '',
            success: false,
            error: parsedError,
          };
        }
      }

      lastError = parsedError;

      // Don't retry on last attempt
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted
  return {
    digest: '',
    success: false,
    error: `Sui network error after ${maxRetries} attempts. Last error: ${lastError}`,
  };
}

/**
 * Invoke contract method (read-only, no transaction)
 */
export async function invokeSuiContractMethod(
  packageId: string,
  module: string,
  functionName: string,
  params: any[] = []
): Promise<SuiInvocationResult> {
  try {
    const client = getSuiClient();
    const txb = new TransactionBlock();
    
    txb.moveCall({
      target: `${packageId}::${module}::${functionName}`,
      arguments: params,
    });

    // For read-only calls, we use dryRun
    const result = await client.dryRunTransactionBlock({
      transactionBlock: await txb.build({ client }),
    });

    if (result.effects.status.status === 'success') {
      return {
        success: true,
        result: result.effects.status,
      };
    } else {
      return {
        success: false,
        error: result.effects.status.error || 'Contract invocation failed',
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: parseSuiError(error),
    };
  }
}

/**
 * Get user role from the blockchain contract using devInspectTransactionBlock
 * (reliable method for reading Table<address, u8> return values)
 */
export async function getRole(address: string): Promise<Role> {
  try {
    if (!address || typeof address !== 'string') {
      logger.warn('GET_ROLE', 'Invalid address', { address });
      return Role.NONE;
    }

    const normalizedAddress = address.toLowerCase().trim();
    const packageId = getPackageIdFromEnv();
    const contractObjectId = getContractObjectIdFromEnv();

    if (!packageId || !contractObjectId) {
      logger.warn('GET_ROLE', 'Missing packageId or contractObjectId env vars');
      return Role.NONE;
    }

    const client = getSuiClient();
    const txb = new TransactionBlock();
    txb.moveCall({
      target: `${packageId}::pharma_nft::get_user_role`,
      arguments: [txb.object(contractObjectId), txb.pure(normalizedAddress, 'address')],
    });

    // Use devInspectTransactionBlock — reliable for reading Table return values
    const result = await client.devInspectTransactionBlock({
      transactionBlock: txb,
      sender: normalizedAddress,
    });

    if (result.effects?.status?.status !== 'success') {
      const errStatus = result.effects?.status?.error;
      logger.warn('GET_ROLE', `devInspect failed for ${normalizedAddress}`, errStatus);
      return Role.NONE;
    }

    // Extract return value: returnValues is [[bytes: Uint8Array, type: string]]
    const returnValues = (result as any).returnValues;
    if (Array.isArray(returnValues) && returnValues.length > 0) {
      const [bytes] = returnValues[0];
      if (bytes && bytes.length > 0) {
        // u8 is a single byte
        const role = Number(new Uint8Array(bytes)[0]) as Role;
        logger.debug('GET_ROLE', `${normalizedAddress} → role=${Role[role] || role}`);
        return role;
      }
    }

    logger.debug('GET_ROLE', `${normalizedAddress} → role=NONE (no return value)`);
    return Role.NONE;
  } catch (error: any) {
    logger.error('GET_ROLE', 'Exception', error?.message || error);
    return Role.NONE;
  }
}

/**
 * Normalize address to Sui format (66 chars: 0x + 64 hex)
 * Accepts Sui format (66 chars), pads shorter addresses to 64 hex chars
 */
function normalizeSuiAddress(address: string): string {
  if (!address || !address.startsWith('0x')) {
    throw new Error('Invalid address format: must start with 0x');
  }

  const cleanAddress = address.toLowerCase().trim();

  // Sui format (66 chars: 0x + 64 hex)
  if (cleanAddress.length === 66) {
    return cleanAddress;
  }

  // Pad shorter addresses to 64 hex chars
  if (cleanAddress.length > 2 && cleanAddress.length < 66) {
    const hexPart = cleanAddress.slice(2); // Remove 0x
    const paddedHex = hexPart.padStart(64, '0'); // Pad to 64 hex chars
    return `0x${paddedHex}`;
  }

  throw new Error(`Invalid address length: ${cleanAddress.length}. Expected 66 characters (0x + 64 hex)`);
}

/**
 * Assign role to user
 */
export async function assignRole(
  address: string,
  role: Role,
  privateKey: string
): Promise<SuiTransactionResult> {
  try {
    // Normalize address to Sui format
    const normalizedAddress = normalizeSuiAddress(address);
    
    const packageId = getPackageIdFromEnv();
    const contractObjectId = getContractObjectIdFromEnv();
    
    // Skip blockchain if contract not available - use database only mode
    // This is a fallback mode when blockchain contract has issues
    const forceDbOnly = process.env.FORCE_DB_ONLY === 'true';
    if (!packageId || !contractObjectId || forceDbOnly) {
      return {
        digest: 'db-only-' + Date.now(),
        success: true,
        error: undefined,
      };
    }

    // Check if contract object exists on chain
    const contractExists = await checkObjectExists(contractObjectId);
    if (!contractExists) {
      return {
        digest: 'db-only-' + Date.now(),
        success: true,
        error: undefined,
      };
    }
    
    // Get client
    const client = getSuiClient();
    
    // Parse private key and get sender address first (this can fail early)
    let keypair: Ed25519Keypair;
    let senderAddress: string;
    try {
      // Use helper function to parse private key (supports multiple formats)
      keypair = parsePrivateKey(privateKey);
      senderAddress = keypair.toSuiAddress();
    } catch (keyError: any) {
      logger.error('ASSIGN_ROLE', 'Error parsing private key', keyError);
      return {
        digest: '',
        success: false,
        error: `Failed to parse private key: ${keyError.message}`,
      };
    }
    
    // Check if contract object exists (non-blocking, just log warning)
    try {
      const objectExists = await checkObjectExists(contractObjectId);
      if (!objectExists) {
        logger.warn('ASSIGN_ROLE', `⚠️ Contract object ${contractObjectId} may not exist on blockchain`);
      }
    } catch (checkError: any) {
      logger.warn('ASSIGN_ROLE', 'Could not verify contract object (continuing anyway)', checkError.message);
      // Continue anyway, might be a network issue
    }
    
    // Check gas balance (non-blocking, just log warning)
    try {
      const balance = await client.getBalance({ owner: senderAddress });
      const balanceMist = BigInt(balance.totalBalance);
      const minRequiredMist = BigInt(1000000000); // 1 SUI = minimum for transaction
      
      if (balanceMist < minRequiredMist) {
        logger.warn('ASSIGN_ROLE', `⚠️ Low SUI balance: ${balance.totalBalance} MIST (${Number(balanceMist) / 1e9} SUI). Transaction may fail.`);
      }
    } catch (balanceError: any) {
      logger.warn('ASSIGN_ROLE', 'Could not check gas balance (continuing anyway)', balanceError.message);
      // Continue anyway, transaction will fail naturally if no gas
    }
    
    // Check if sender has ADMIN role (non-blocking, just log warning)
    try {
      const senderRole = await getRole(senderAddress);
      logger.info('ASSIGN_ROLE', `Sender role check: ${senderAddress} → ${Role[senderRole] || senderRole}`);
      if (senderRole !== Role.ADMIN) {
        logger.warn('ASSIGN_ROLE', `⚠️ Sender address ${senderAddress} does not have ADMIN role. Current role: ${Role[senderRole] || 'NONE'}. Transaction will likely FAIL.`);
      } else {
        logger.info('ASSIGN_ROLE', `✓ Sender has ADMIN role — proceeding with assign_role tx`);
      }
    } catch (roleError: any) {
      logger.warn('ASSIGN_ROLE', 'Could not check sender role (might be first time setup, continuing anyway)', roleError.message);
      // Continue anyway - might be initial setup
    }
    
    
    // Retry mechanism: try up to 3 times
    let result;
    let lastError: string | undefined;
    const maxRetries = 3;

    // Get AdminCap ID once before the retry loop (efficiency)
    const adminCapObjectId = getAdminCapObjectId();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        
        // Create fresh transaction block for each attempt
        const attemptTxb = new TransactionBlock();

        // Set gas budget explicitly to avoid auto-budget issues
        attemptTxb.setGasBudget(50000000); // 0.05 SUI

        // Use assign_role with AdminCap
        // Function signature: assign_role(contract, admin_cap, user, role, ctx)
        attemptTxb.moveCall({
          target: `${packageId}::pharma_nft::assign_role`,
          arguments: [
            attemptTxb.object(contractObjectId),
            attemptTxb.object(adminCapObjectId ?? ''),
            attemptTxb.pure(normalizedAddress, 'address'), // Explicitly specify address type
            attemptTxb.pure(Number(role), 'u8'), // Ensure role is u8
          ],
        });
        
        // Note: sender will be set in signAndSendTransaction function
        
        result = await signAndSendTransaction(attemptTxb, privateKey);
        
        if (result.success) {
          return result;
        } else {
          lastError = result.error;
          logger.warn('ASSIGN_ROLE', `Attempt ${attempt} failed: ${result.error}`);
          
          // If it's a non-retryable error (like invalid role), don't retry
          if (result.error?.includes('Invalid role') || 
              result.error?.includes('does not have ADMIN role') ||
              result.error?.includes('Only admin can assign roles') ||
              result.error?.includes('Invalid private key') ||
              result.error?.includes('Invalid address format')) {
            return result;
          }
          
          // Wait before retry (exponential backoff)
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5 seconds
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      } catch (error: any) {
        lastError = error.message || String(error);
        logger.error('ASSIGN_ROLE', `Attempt ${attempt} threw error`, lastError);
        
        // If it's a non-retryable error, don't retry
        if (error.message?.includes('Invalid private key') || 
            error.message?.includes('Invalid address format')) {
          return {
            digest: '',
            success: false,
            error: parseSuiError(error),
          };
        }
        
        // Wait before retry
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    logger.error('ASSIGN_ROLE', `❌ Failed to assign role after ${maxRetries} attempts`, { lastError });
    return {
      digest: '',
      success: false,
      error: lastError || 'Transaction failed after multiple retries',
    };
  } catch (error: any) {
    logger.error('ASSIGN_ROLE', 'Error in assignRole', error);
    const errorMessage = parseSuiError(error);
    logger.debug('ASSIGN_ROLE', 'Parsed error', errorMessage);
    return {
      digest: '',
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Mint product NFT
 */
export async function mintProductNFT(
  uri: string,
  batchNumber: string,
  expiryDate: number,
  privateKey: string
): Promise<SuiTransactionResult & { objectId?: string }> {
  try {
    const packageId = getPackageIdFromEnv();
    const contractObjectId = getContractObjectIdFromEnv();
    
    const txb = new TransactionBlock();
    
    // Mint NFT - contract expects 8 args: contract, uri, batch_number, drug_name, description, expiry_date, quantity, clock
    const [nft] = txb.moveCall({
      target: `${packageId}::pharma_nft::mint_product_nft`,
      arguments: [
        txb.object(contractObjectId),       // contract: &mut PharmaNFTContract
        txb.pure(uri),                     // uri: String
        txb.pure(batchNumber),            // batch_number: String
        txb.pure(batchNumber),            // drug_name: String
        txb.pure(uri),                     // description: String
        txb.pure(expiryDate, 'u64'),      // expiry_date: u64
        txb.pure(1, 'u64'),               // quantity: u64 (default 1)
        txb.object('0x6'),                // clock: &Clock
      ],
    });

    // Transfer to caller
    const signerAddress = await getSignerAddress(privateKey);
    txb.transferObjects([nft], signerAddress);

    const result = await signAndSendTransaction(txb, privateKey);
    
    // Extract object ID from transaction result
    if (result.success) {
      try {
        const client = getSuiClient();
        const txInfo = await client.getTransactionBlock({
          digest: result.digest,
          options: {
            showObjectChanges: true,
          },
        });
        
        // Find the created NFT object
        const createdObjects = txInfo.objectChanges?.filter(
          (change: any) => change.type === 'created'
        );
        
        if (createdObjects && createdObjects.length > 0) {
          const nftObject = (createdObjects as any[]).find((obj: any) =>
            obj.objectType?.includes('PharmaNFT') || obj.objectType?.includes('pharma_nft')
          );
          if (nftObject) {
            return {
              ...result,
              objectId: (nftObject as any).objectId,
            };
          }
        }
      } catch (error) {
        logger.error('MINT_NFT', 'Error extracting object ID', error);
        // Return result without objectId if extraction fails
      }
    }

    return result;
  } catch (error: any) {
    return {
      digest: '',
      success: false,
      error: parseSuiError(error),
    };
  }
}

/**
 * Get signer address from private key
 */
async function getSignerAddress(privateKey: string): Promise<string> {
  try {
    const keypair = parsePrivateKey(privateKey);
    return keypair.toSuiAddress();
  } catch (error: any) {
    throw new Error(`Invalid private key format: ${error.message || error}`);
  }
}

/**
 * Transfer product NFT
 * Contract validates role, expired status, and transfer restrictions.
 *
 * FIX: Added pre-flight checks to surface MoveAbort reasons before hitting blockchain.
 * FIX: Removed duplicate setGasBudget (now handled centrally in signAndSendTransaction).
 */
export async function transferProductNFT(
  objectId: string,
  to: string,
  privateKey: string
): Promise<SuiTransactionResult> {
  try {
    const packageId = getPackageIdFromEnv();
    const contractObjectId = getContractObjectId();

    // --- FIX 1: Validate config before building transaction ---
    if (!packageId || !contractObjectId) {
      return {
        digest: '',
        success: false,
        error: 'Contract chưa được cấu hình đầy đủ. Kiểm tra SUI_PACKAGE_ID và SUI_CONTRACT_OBJECT_ID.',
      };
    }

    // --- FIX 2: Resolve objectId ---
    // objectId từ database có thể là:
    //   1. Sui object ID thật (0x...)  → dùng trực tiếp
    //   2. batch_number (LOT202506AW)  → tra cứu trên blockchain
    let resolvedObjectId = objectId;
    if (!objectId.startsWith('0x')) {
      logger.warn('CONTRACT', `objectId "${objectId}" không phải định dạng Sui. Đang tra cứu batch_number...`);

      // Nếu không phải Sui address → nó là batch_number.
      // owner_address lấy từ transaction.sender (người ký = manufacturer).
      // Dùng Ed25519Keypair parse từ privateKey để lấy address.
      try {
        const keypair = parsePrivateKey(privateKey);
        const manufacturerAddress = keypair.getPublicKey().toSuiAddress();
        const foundId = await lookupNFTByBatchNumber(objectId, manufacturerAddress);
        if (foundId) {
          resolvedObjectId = foundId;
          logger.info('CONTRACT', `Resolved "${objectId}" → "${resolvedObjectId}"`);
        }
      } catch (lookupError) {
        logger.warn('CONTRACT', 'Lỗi khi tra cứu batch_number', lookupError);
      }

      // Nếu vẫn không tìm được → báo lỗi có hướng dẫn
      if (!resolvedObjectId.startsWith('0x')) {
        return {
          digest: '',
          success: false,
          error: `NFT "${objectId}" không tồn tại trên blockchain. Có thể NFT chưa được mint thành công. Kiểm tra transaction mint trên blockchain explorer.`,
        };
      }
    }

    if (!to || !to.startsWith('0x')) {
      return {
        digest: '',
        success: false,
        error: 'Địa chỉ nhận phải là địa chỉ Sui hợp lệ (0x...).',
      };
    }

    // --- FIX 3: Check contract object exists on-chain (early warning) ---
    const contractExists = await checkObjectExists(contractObjectId);
    if (!contractExists) {
      return {
        digest: '',
        success: false,
        error: `Contract object ${contractObjectId} không tồn tại trên blockchain. Kiểm tra SUI_CONTRACT_OBJECT_ID và đảm bảo contract đã được deploy.`,
      };
    }

    // --- FIX 4: Check NFT object exists on-chain ---
    const nftExists = await checkObjectExists(resolvedObjectId);
    if (!nftExists) {
      return {
        digest: '',
        success: false,
        error: `NFT "${resolvedObjectId}" không tồn tại trên blockchain. Kiểm tra object_id của NFT trong database.`,
      };
    }

    // NOTE: We intentionally skip ALL pre-flight role checks.
    // - sender = OWNER_PRIVATE_KEY (server admin wallet), role check meaningless
    // - recipient = contract's Table may take time to sync after assign_role tx
    // The smart contract's `transfer_product_nft` returns accurate MoveAbort codes:
    //   code=1: not authorized, code=2: not MANUFACTURER, code=5: invalid transfer route
    // Just send the transaction and let the contract validate.

    const txb = new TransactionBlock();

    // Note: gas budget is set centrally in signAndSendTransaction
    // to ensure it happens before build() and with a generous amount (0.2 SUI)

    txb.moveCall({
      target: `${packageId}::pharma_nft::transfer_product_nft`,
      arguments: [
        txb.object(resolvedObjectId),  // ✅ NFT object đã được resolve
        txb.object(contractObjectId),  // Contract object
        txb.pure(to, 'address'),       // To address (explicitly as address type)
        txb.object('0x6'),             // Clock object (Sui standard clock)
      ],
    });

    return await signAndSendTransaction(txb, privateKey);
  } catch (error: any) {
    // Wrap ALL errors so they never escape uncaught
    return {
      digest: '',
      success: false,
      error: parseSuiError(error),
    };
  }
}

/**
 * Get token owner
 */
export async function getTokenOwner(objectId: string): Promise<string | null> {
  try {
    const client = getSuiClient();
    const object = await client.getObject({
      id: objectId,
      options: {
        showOwner: true,
      },
    });

    if (object.data?.owner) {
      const owner = object.data.owner;
      if (typeof owner === 'string') {
        return owner;
      }
      if (typeof owner === 'object' && 'AddressOwner' in owner) {
        return (owner as any).AddressOwner;
      }
    }
    return null;
  } catch (error) {
    logger.error('TOKEN', 'Error getting token owner', error);
    return null;
  }
}

/**
 * Get balance of owner (count of NFTs)
 */
export async function balanceOf(owner: string): Promise<number> {
  try {
    const client = getSuiClient();
    const objects = await client.getOwnedObjects({
      owner,
      filter: {
        StructType: `${getPackageIdFromEnv()}::pharma_nft::PharmaNFT`,
      },
      options: {
        showType: true,
      },
    });
    return objects.data.length;
  } catch (error) {
    logger.error('TOKEN', 'Error getting balance', error);
    return 0;
  }
}

/**
 * Get all tokens owned by address
 */
export async function tokensOf(owner: string): Promise<string[]> {
  try {
    const client = getSuiClient();
    const objects = await client.getOwnedObjects({
      owner,
      filter: {
        StructType: `${getPackageIdFromEnv()}::pharma_nft::PharmaNFT`,
      },
      options: {
        showType: true,
      },
    });
    return objects.data.map((obj) => obj.data?.objectId || '').filter(Boolean);
  } catch (error) {
    logger.error('TOKEN', 'Error getting tokens', error);
    return [];
  }
}

/**
 * Get token properties
 */
export async function getTokenProperties(objectId: string): Promise<SuiTokenMetadata | null> {
  try {
    const client = getSuiClient();
    const object = await client.getObject({
      id: objectId,
      options: {
        showType: true,
        showContent: true,
        showOwner: true,
      },
    });

    if (!object.data || !object.data.content) {
      return null;
    }

    const content = object.data.content as any;
    const fields = content.fields || {};

    return {
      owner: !object.data.owner
        ? ''
        : typeof object.data.owner === 'object' && 'AddressOwner' in object.data.owner
        ? (object.data.owner as any).AddressOwner
        : (object.data.owner as string) || '',
      objectId,
      uri: fields.uri || '',
      batch_number: fields.batch_number || '',
      expiry_date: Number(fields.expiry_date || 0),
      expired: Boolean(fields.expired || false),
      type: object.data.type || '',
    };
  } catch (error) {
    logger.error('TOKEN', 'Error getting token properties', error);
    return null;
  }
}

/**
 * Lookup NFT object ID by batch number on blockchain.
 * Used when database has batch_number but not object_id.
 */
export async function lookupNFTByBatchNumber(
  batchNumber: string,
  manufacturerAddress: string
): Promise<string | null> {
  try {
    const client = getSuiClient();
    const packageId = getPackageIdFromEnv();

    if (!packageId) {
      logger.warn('TOKEN', 'Cannot lookup NFT: SUI_PACKAGE_ID not configured');
      return null;
    }

    // Get all PharmaNFT objects owned by the manufacturer
    const objects = await client.getOwnedObjects({
      owner: manufacturerAddress,
      filter: {
        StructType: `${packageId}::pharma_nft::PharmaNFT`,
      },
      options: {
        showContent: true,
      },
    });

    // Find the one with matching batch_number
    for (const obj of objects.data) {
      if (!obj.data?.objectId) continue;

      try {
        const metadata = await getTokenProperties(obj.data.objectId);
        if (metadata && metadata.batch_number === batchNumber) {
          logger.info('TOKEN', `Found NFT by batch number: ${batchNumber} → ${obj.data.objectId}`);
          return obj.data.objectId;
        }
      } catch {
        // Skip objects that fail to fetch metadata
        continue;
      }
    }

    logger.warn('TOKEN', `NFT with batch number "${batchNumber}" not found on blockchain`);
    return null;
  } catch (error) {
    logger.error('TOKEN', 'Error looking up NFT by batch number', error);
    return null;
  }
}

/**
 * Check if product is expired
 */
export async function isProductExpired(objectId: string): Promise<boolean> {
  try {
    const metadata = await getTokenProperties(objectId);
    if (!metadata) {
      return false;
    }

    if (metadata.expired) {
      return true;
    }

    // Check expiry date (stored in milliseconds, matching Move contract)
    if (metadata.expiry_date > 0) {
      const now = Date.now();
      return now >= metadata.expiry_date;
    }

    return false;
  } catch (error) {
    logger.error('TOKEN', 'Error checking expiry', error);
    return false;
  }
}

/**
 * Admin transfer
 */
export async function adminTransfer(
  objectId: string,
  to: string,
  privateKey: string
): Promise<SuiTransactionResult> {
  try {
    const packageId = getPackageIdFromEnv();
    const contractObjectId = getContractObjectIdFromEnv();
    const adminCapObjectId = getAdminCapObjectId();

    if (!adminCapObjectId) {
      return {
        digest: '',
        success: false,
        error: 'SUI_ADMIN_CAP_OBJECT_ID chưa được cấu hình',
      };
    }

    const txb = new TransactionBlock();
    txb.setGasBudget(100000000); // 0.1 SUI
    txb.moveCall({
      target: `${packageId}::pharma_nft::admin_transfer`,
      arguments: [
        txb.object(objectId),            // NFT object
        txb.object(contractObjectId),    // Contract object
        txb.object(adminCapObjectId),    // AdminCap object
        txb.pure(to, 'address'),         // To address
      ],
    });

    return await signAndSendTransaction(txb, privateKey);
  } catch (error: any) {
    return {
      digest: '',
      success: false,
      error: parseSuiError(error),
    };
  }
}

