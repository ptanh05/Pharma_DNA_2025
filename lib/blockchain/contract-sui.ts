/**
 * Sui Contract Interaction
 * Functions to interact with PharmaNFT smart contract on Sui
 */

import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
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
    // Sui private keys are typically base64 or hex encoded
    let keypair: Ed25519Keypair;
    try {
      // Try hex format first
      if (privateKey.startsWith('0x')) {
        const privateKeyBytes = Uint8Array.from(Buffer.from(privateKey.slice(2), 'hex'));
        keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      } else {
        // Try base64
        const privateKeyBytes = Uint8Array.from(Buffer.from(privateKey, 'base64'));
        keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      }
    } catch (error) {
      // If that fails, try as raw hex string
      const privateKeyBytes = Uint8Array.from(Buffer.from(privateKey.replace('0x', ''), 'hex'));
      keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
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
 * Assign role to user
 */
export async function assignRole(
  address: string,
  role: Role,
  privateKey: string
): Promise<SuiTransactionResult> {
  try {
    const packageId = getPackageIdFromEnv();
    const contractObjectId = getContractObjectIdFromEnv();
    
    const txb = new TransactionBlock();
    txb.moveCall({
      target: `${packageId}::pharma_nft::assign_role`,
      arguments: [
        txb.object(contractObjectId),
        txb.pure(address),
        txb.pure(role),
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

