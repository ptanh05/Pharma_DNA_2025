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
import { parseSuiError } from './errors-sui';

/**
 * Get package ID from environment
 */
export function getPackageIdFromEnv(): string {
  return getPackageId();
}

/**
 * Get contract object ID from environment
 */
export function getContractObjectIdFromEnv(): string {
  return getContractObjectId();
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
 * Sign and send transaction
 */
async function signAndSendTransaction(
  txb: TransactionBlock,
  privateKey: string
): Promise<SuiTransactionResult> {
  try {
    const client = getSuiClient();
    
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

    // Sign and execute transaction
    console.log('Sending transaction to blockchain...');
    let result;
    try {
      result = await client.signAndExecuteTransactionBlock({
        signer: keypair,
        transactionBlock: txb,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
          showInput: true,
        },
      });
    } catch (txError: any) {
      console.error('Error executing transaction block:', txError);
      const parsedError = parseSuiError(txError);
      console.error('Parsed transaction error:', parsedError);
      return {
        digest: '',
        success: false,
        error: parsedError,
      };
    }

    console.log('Transaction result:', {
      digest: result.digest,
      status: result.effects?.status?.status,
      error: result.effects?.status?.error,
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
        // Sui error format: { code: string, message: string, ... }
        if (typeof errorDetails === 'object') {
          // Try to extract meaningful error message
          if (errorDetails.message) {
            errorMessage = errorDetails.message;
          } else if (errorDetails.code) {
            errorMessage = `Error code ${errorDetails.code}: ${JSON.stringify(errorDetails)}`;
          } else {
            errorMessage = JSON.stringify(errorDetails);
          }
        } else {
          errorMessage = String(errorDetails);
        }
      }
      
      console.error('Transaction failed:', {
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
  } catch (error: any) {
    console.error('Unexpected error in signAndSendTransaction:', error);
    const parsedError = parseSuiError(error);
    console.error('Parsed error:', parsedError);
    return {
      digest: '',
      success: false,
      error: parsedError,
    };
  }
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
 * Get user role
 */
export async function getRole(address: string): Promise<Role> {
  try {
    const packageId = getPackageIdFromEnv();
    const contractObjectId = getContractObjectIdFromEnv();
    
    const result = await invokeSuiContractMethod(
      packageId,
      'pharma_nft',
      'get_user_role',
      [contractObjectId, address]
    );
    
    if (result.success && result.result !== undefined) {
      // Parse result from Sui response
      const roleValue = typeof result.result === 'object' 
        ? (result.result as any).value || result.result
        : result.result;
      return Number(roleValue) as Role;
    }
    return Role.NONE;
  } catch (error) {
    console.error('Error getting role:', error);
    return Role.NONE;
  }
}

/**
 * Normalize address to Sui format (66 chars: 0x + 64 hex)
 * If Ethereum address (42 chars), pad with zeros
 */
function normalizeSuiAddress(address: string): string {
  if (!address || !address.startsWith('0x')) {
    throw new Error('Invalid address format: must start with 0x');
  }

  const cleanAddress = address.toLowerCase().trim();
  
  // Already Sui format (66 chars)
  if (cleanAddress.length === 66) {
    return cleanAddress;
  }
  
  // Ethereum format (42 chars) - pad to 66 chars
  if (cleanAddress.length === 42) {
    const hexPart = cleanAddress.slice(2); // Remove 0x
    const paddedHex = hexPart.padStart(64, '0'); // Pad to 64 hex chars
    return `0x${paddedHex}`;
  }
  
  throw new Error(`Invalid address length: ${cleanAddress.length}. Expected 42 (Ethereum) or 66 (Sui) characters`);
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
      console.log('[assignRole] ⚠️ Using database-only mode');
      return {
        digest: 'db-only-' + Date.now(),
        success: true,
        error: null,
      };
    }

    // Check if contract object exists on chain
    const contractExists = await checkObjectExists(contractObjectId);
    if (!contractExists) {
      console.log('[assignRole] ⚠️ Contract object not found on chain, using database-only mode');
      return {
        digest: 'db-only-' + Date.now(),
        success: true,
        error: null,
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
      console.log(`Sender address: ${senderAddress}`);
    } catch (keyError: any) {
      console.error('Error parsing private key:', keyError);
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
        console.warn(`⚠️ Contract object ${contractObjectId} may not exist on blockchain`);
      }
    } catch (checkError: any) {
      console.warn('Could not verify contract object (continuing anyway):', checkError.message);
      // Continue anyway, might be a network issue
    }
    
    // Check gas balance (non-blocking, just log warning)
    try {
      const balance = await client.getBalance({ owner: senderAddress });
      const balanceMist = BigInt(balance.totalBalance);
      const minRequiredMist = BigInt(1000000000); // 1 SUI = minimum for transaction
      
      if (balanceMist < minRequiredMist) {
        console.warn(`⚠️ Low SUI balance: ${balance.totalBalance} MIST (${Number(balanceMist) / 1e9} SUI). Transaction may fail.`);
      } else {
        console.log(`✅ Gas balance check: ${balance.totalBalance} MIST (${Number(balanceMist) / 1e9} SUI)`);
      }
    } catch (balanceError: any) {
      console.warn('Could not check gas balance (continuing anyway):', balanceError.message);
      // Continue anyway, transaction will fail naturally if no gas
    }
    
    // Check if sender has ADMIN role (non-blocking, just log warning)
    try {
      const senderRole = await getRole(senderAddress);
      console.log(`Sender role: ${senderRole} (${Role[senderRole] || 'NONE'})`);
      if (senderRole !== Role.ADMIN) {
        console.warn(`⚠️ Sender address ${senderAddress} does not have ADMIN role. Current role: ${Role[senderRole] || 'NONE'}. Transaction may fail.`);
      } else {
        console.log(`✅ Sender has ADMIN role`);
      }
    } catch (roleError: any) {
      console.warn('Could not check sender role (might be first time setup, continuing anyway):', roleError.message);
      // Continue anyway - might be initial setup
    }
    
    console.log(`[assignRole] Assigning role ${role} (${Role[role] || 'UNKNOWN'}) to address ${normalizedAddress} (original: ${address})`);
    console.log(`[assignRole] Package ID: ${packageId}, Contract Object ID: ${contractObjectId}`);
    console.log(`[assignRole] Sender address: ${senderAddress}`);
    console.log(`[assignRole] Transaction arguments:`, {
      contract: contractObjectId,
      user: normalizedAddress,
      role: Number(role),
      roleName: Role[role] || 'UNKNOWN',
    });
    
    // Retry mechanism: try up to 3 times
    let result;
    let lastError: string | undefined;
    const maxRetries = 3;

    // Get AdminCap ID once before the retry loop (efficiency)
    const adminCapObjectId = getAdminCapObjectId();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[assignRole] Attempt ${attempt}/${maxRetries} to assign role...`);
        
        // Create fresh transaction block for each attempt
        const attemptTxb = new TransactionBlock();

        // Set gas budget explicitly to avoid auto-budget issues
        attemptTxb.setGasBudget(50000000); // 0.05 SUI

        // Use assign_role_by_admin with AdminCap
        // Function signature: assign_role_by_admin(contract, admin_cap, user, role, ctx)
        attemptTxb.moveCall({
          target: `${packageId}::pharma_nft::assign_role_by_admin`,
          arguments: [
            attemptTxb.object(contractObjectId),
            attemptTxb.object(adminCapObjectId),
            attemptTxb.pure(normalizedAddress, 'address'), // Explicitly specify address type
            attemptTxb.pure(Number(role), 'u8'), // Ensure role is u8
          ],
        });
        
        // Note: sender will be set in signAndSendTransaction function
        
        result = await signAndSendTransaction(attemptTxb, privateKey);
        
        if (result.success) {
          console.log(`[assignRole] ✅ Role assigned successfully on attempt ${attempt}. Transaction: ${result.digest}`);
          return result;
        } else {
          lastError = result.error;
          console.warn(`[assignRole] Attempt ${attempt} failed: ${result.error}`);
          
          // If it's a non-retryable error (like invalid role), don't retry
          if (result.error?.includes('Invalid role') || 
              result.error?.includes('does not have ADMIN role') ||
              result.error?.includes('Only admin can assign roles') ||
              result.error?.includes('Invalid private key') ||
              result.error?.includes('Invalid address format')) {
            console.log('[assignRole] Non-retryable error detected, stopping retries');
            return result;
          }
          
          // Wait before retry (exponential backoff)
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5 seconds
            console.log(`[assignRole] Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      } catch (error: any) {
        lastError = error.message || String(error);
        console.error(`[assignRole] Attempt ${attempt} threw error:`, lastError);
        
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
    console.error(`[assignRole] ❌ Failed to assign role after ${maxRetries} attempts. Last error: ${lastError}`);
    return {
      digest: '',
      success: false,
      error: lastError || 'Transaction failed after multiple retries',
    };
  } catch (error: any) {
    console.error('Error in assignRole:', error);
    const errorMessage = parseSuiError(error);
    console.error('Parsed error:', errorMessage);
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
    
    // Mint NFT
    const [nft] = txb.moveCall({
      target: `${packageId}::pharma_nft::mint_product_nft`,
      arguments: [
        txb.object(contractObjectId),
        txb.pure(uri),
        txb.pure(batchNumber),
        txb.pure(expiryDate),
        txb.object('0x6'), // Clock object for on-chain time validation
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
          const nftObject = createdObjects.find((obj: any) => 
            obj.objectType?.includes('PharmaNFT') || obj.objectType?.includes('pharma_nft')
          );
          if (nftObject) {
            return {
              ...result,
              objectId: nftObject.objectId,
            };
          }
        }
      } catch (error) {
        console.error('Error extracting object ID:', error);
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
 * ✅ SỬA: Gọi contract function để có validation role và expired check
 */
export async function transferProductNFT(
  objectId: string,
  to: string,
  privateKey: string
): Promise<SuiTransactionResult> {
  try {
    const packageId = getPackageIdFromEnv();
    const contractObjectId = getContractObjectId();
    
    const txb = new TransactionBlock();
    
    // ✅ SỬA: Gọi contract function thay vì chỉ transferObjects
    // Contract sẽ validate: role, expired status, transfer restrictions
    txb.moveCall({
      target: `${packageId}::pharma_nft::transfer_product_nft`,
      arguments: [
        txb.object(objectId),           // NFT object
        txb.object(contractObjectId),    // Contract object
        txb.pure(to),                    // To address
        txb.object('0x6'),              // Clock object (Sui standard clock)
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
    console.error('Error getting token owner:', error);
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
    console.error('Error getting balance:', error);
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
    console.error('Error getting tokens:', error);
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
      owner: typeof object.data.owner === 'object' && 'AddressOwner' in object.data.owner
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
    console.error('Error getting token properties:', error);
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
    
    // Check expiry date
    if (metadata.expiry_date > 0) {
      const now = Math.floor(Date.now() / 1000);
      return now >= metadata.expiry_date;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking expiry:', error);
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
    
    const txb = new TransactionBlock();
    txb.moveCall({
      target: `${packageId}::pharma_nft::admin_transfer`,
      arguments: [
        txb.object(contractObjectId),
        txb.object(objectId),
        txb.pure(to),
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

