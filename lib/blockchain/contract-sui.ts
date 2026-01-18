/**
 * Sui Contract Interaction
 * Functions to interact with PharmaNFT smart contract on Sui
 */

import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { bech32 } from 'bech32';
import { getSuiRpcUrl, getSuiExplorerTxUrl } from './config-sui';
import { getSuiClient, getPackageId, getContractObjectId } from './provider-sui';
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
 * Sign and send transaction
 */
async function signAndSendTransaction(
  txb: TransactionBlock,
  privateKey: string
): Promise<SuiTransactionResult> {
  try {
    const client = getSuiClient();
    
    // Create keypair from private key
    // Sui private keys can be bech32 format (suiprivkey1...), hex, or base64
    let keypair: Ed25519Keypair;
    try {
      // Check if it's bech32 format (suiprivkey1...)
      if (privateKey.startsWith('suiprivkey1')) {
        // Decode bech32 to get raw bytes
        // Bech32 format: suiprivkey1 + base32 encoded bytes
        const decoded = bech32.decode(privateKey);
        const privateKeyBytes = Uint8Array.from(bech32.fromWords(decoded.words));
        // Sui private key is 32 bytes, but bech32 might include version byte
        // Take the last 32 bytes if longer
        const keyBytes = privateKeyBytes.length > 32 
          ? privateKeyBytes.slice(-32) 
          : privateKeyBytes;
        keypair = Ed25519Keypair.fromSecretKey(keyBytes);
      } else if (privateKey.startsWith('0x')) {
        // Hex format
        const privateKeyBytes = Uint8Array.from(Buffer.from(privateKey.slice(2), 'hex'));
        keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      } else if (privateKey.length === 64 && /^[0-9a-fA-F]+$/.test(privateKey)) {
        // Raw hex string (64 chars = 32 bytes)
        const privateKeyBytes = Uint8Array.from(Buffer.from(privateKey, 'hex'));
        keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      } else {
        // Try base64
        const privateKeyBytes = Uint8Array.from(Buffer.from(privateKey, 'base64'));
        keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      }
    } catch (error: any) {
      throw new Error(`Invalid private key format: ${error.message || error}`);
    }

    // Sign and execute transaction
    const result = await client.signAndExecuteTransactionBlock({
      signer: keypair,
      transactionBlock: txb,
      options: {
        showEffects: true,
        showEvents: true,
        showObjectChanges: true,
      },
    });

    if (result.effects?.status?.status === 'success') {
      return {
        digest: result.digest,
        success: true,
        checkpoint: Number(result.checkpoint || 0),
      };
    } else {
      return {
        digest: result.digest,
        success: false,
        error: result.effects?.status?.error || 'Transaction failed',
      };
    }
  } catch (error: any) {
    return {
      digest: '',
      success: false,
      error: parseSuiError(error),
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
    
    if (!packageId || !contractObjectId) {
      throw new Error('SUI_PACKAGE_ID or SUI_CONTRACT_OBJECT_ID not configured');
    }
    
    const txb = new TransactionBlock();
    // Use assign_role_by_admin which doesn't require AdminCap
    // This works if the caller already has ADMIN role (set during init)
    txb.moveCall({
      target: `${packageId}::pharma_nft::assign_role_by_admin`,
      arguments: [
        txb.object(contractObjectId),
        txb.pure(normalizedAddress),
        txb.pure(role),
      ],
    });

    console.log(`Assigning role ${role} to address ${normalizedAddress} (original: ${address})`);
    const result = await signAndSendTransaction(txb, privateKey);
    
    if (result.success) {
      console.log(`✅ Role assigned successfully. Transaction: ${result.digest}`);
    } else {
      console.error(`❌ Failed to assign role: ${result.error}`);
    }
    
    return result;
  } catch (error: any) {
    console.error('Error in assignRole:', error);
    return {
      digest: '',
      success: false,
      error: parseSuiError(error),
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
    let keypair: Ed25519Keypair;
    if (privateKey.startsWith('0x')) {
      const privateKeyBytes = Uint8Array.from(Buffer.from(privateKey.slice(2), 'hex'));
      keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
    } else {
      const privateKeyBytes = Uint8Array.from(Buffer.from(privateKey, 'base64'));
      keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
    }
    return keypair.toSuiAddress();
  } catch (error) {
    throw new Error('Invalid private key format');
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

