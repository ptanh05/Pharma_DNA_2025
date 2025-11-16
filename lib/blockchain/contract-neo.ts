/**
 * Neo N3 Contract Interaction
 * Functions to interact with PharmaNFT smart contract
 */

import { wallet, rpc, u, sc, tx } from '@cityofzion/neon-core';
import { getRpcUrl, getChainId } from './config';
import { getRpcClient, getContractHash } from './provider-neo';
import { TransactionResult, InvocationResult, Role, TokenMetadata } from './types';
import { parseNeoError } from './errors';

/**
 * Get contract hash from environment
 */
export function getContractHashFromEnv(): string {
  return getContractHash();
}

/**
 * Build invocation script for contract method
 */
function buildInvocationScript(
  contractHash: string,
  method: string,
  params: any[] = []
): u.HexString {
  const scriptBuilder = new sc.ScriptBuilder();
  const contractHashHex = u.HexString.fromHex(contractHash);

  // Convert params to ContractParam
  const contractParams = params.map((param) => {
    if (typeof param === 'string') {
      // Check if it's a hex address (UInt160)
      if (param.startsWith('0x') && param.length === 42) {
        return sc.ContractParam.hash160(param);
      }
      return sc.ContractParam.string(param);
    } else if (typeof param === 'number' || typeof param === 'bigint') {
      return sc.ContractParam.integer(Number(param));
    } else if (typeof param === 'boolean') {
      return sc.ContractParam.boolean(param);
    } else if (Array.isArray(param)) {
      // Convert array elements to ContractParam first
      const arrayParams: sc.ContractParam[] = param.map((p) => {
        if (typeof p === 'string' && p.startsWith('0x') && p.length === 42) {
          return sc.ContractParam.hash160(p);
        } else if (typeof p === 'number' || typeof p === 'bigint') {
          return sc.ContractParam.integer(Number(p));
        } else if (typeof p === 'boolean') {
          return sc.ContractParam.boolean(p);
        }
        return sc.ContractParam.string(String(p));
      });
      // Create array ContractParam using spread operator (array() is variadic)
      return sc.ContractParam.array(...arrayParams);
    }
    return sc.ContractParam.string(String(param));
  });

  scriptBuilder.emitAppCall(contractHashHex, method, contractParams);
  return u.HexString.fromHex(scriptBuilder.build());
}

/**
 * Invoke contract method (read-only, no transaction)
 */
export async function invokeContractMethod(
  contractHash: string,
  method: string,
  params: any[] = []
): Promise<InvocationResult> {
  try {
    const script = buildInvocationScript(contractHash, method, params);
    const client = getRpcClient();
    const result = await client.invokeScript(script);

    if (result.state === 'HALT' && result.stack && result.stack.length > 0) {
      return {
        success: true,
        result: result.stack[0].value,
      };
    } else {
      return {
        success: false,
        error: result.exception || 'Contract invocation failed',
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: parseNeoError(error),
    };
  }
}

/**
 * Sign and send transaction
 */
async function signAndSendTransaction(
  script: u.HexString,
  privateKey: string,
  networkMagic?: number
): Promise<TransactionResult> {
  try {
    const account = new wallet.Account(privateKey);
    const client = getRpcClient();
    const chainId = networkMagic || getChainId();

    // Build transaction
    const transaction = new tx.Transaction();
    transaction.script = script;
    transaction.networkFee = u.BigInteger.fromNumber(10000000); // 0.1 GAS
    transaction.systemFee = u.BigInteger.fromNumber(10000000); // 0.1 GAS

    // Create signer
    const signer = new tx.Signer();
    signer.account = u.HexString.fromHex(account.scriptHash);
    signer.scopes = tx.WitnessScope.CalledByEntry;
    transaction.signers = [signer];

    // Get current block height
    const blockCount = await client.getBlockCount();
    transaction.validUntilBlock = blockCount + 1000;

    // Sign transaction
    transaction.sign(account, chainId);

    // Send transaction
    const result = await client.sendRawTransaction(transaction);
    const txHash = transaction.hash();

    if (result) {
      // Wait for confirmation (optional, can be done async)
      return {
        txHash,
        success: true,
      };
    } else {
      return {
        txHash: '',
        success: false,
        error: 'Transaction failed to send',
      };
    }
  } catch (error: any) {
    return {
      txHash: '',
      success: false,
      error: parseNeoError(error),
    };
  }
}

/**
 * Get user role
 */
export async function getRole(address: string): Promise<Role> {
  try {
    const contractHash = getContractHashFromEnv();
    const result = await invokeContractMethod(contractHash, 'get_user_role', [address]);
    
    if (result.success && result.result !== undefined) {
      return Number(result.result) as Role;
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
): Promise<TransactionResult> {
  try {
    const contractHash = getContractHashFromEnv();
    const script = buildInvocationScript(contractHash, 'assign_role', [address, role]);
    return await signAndSendTransaction(script, privateKey);
  } catch (error: any) {
    return {
      txHash: '',
      success: false,
      error: parseNeoError(error),
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
): Promise<TransactionResult> {
  try {
    const contractHash = getContractHashFromEnv();
    const script = buildInvocationScript(contractHash, 'mint_product_nft', [
      uri,
      batchNumber,
      expiryDate,
    ]);
    return await signAndSendTransaction(script, privateKey);
  } catch (error: any) {
    return {
      txHash: '',
      success: false,
      error: parseNeoError(error),
    };
  }
}

/**
 * Batch mint product NFTs
 */
export async function batchMintProductNFT(
  uris: string[],
  batchNumbers: string[],
  expiryDates: number[],
  privateKey: string
): Promise<TransactionResult> {
  try {
    const contractHash = getContractHashFromEnv();
    const script = buildInvocationScript(contractHash, 'batch_mint_product_nft', [
      uris,
      batchNumbers,
      expiryDates,
    ]);
    return await signAndSendTransaction(script, privateKey);
  } catch (error: any) {
    return {
      txHash: '',
      success: false,
      error: parseNeoError(error),
    };
  }
}

/**
 * Transfer product NFT
 */
export async function transferProductNFT(
  tokenId: number,
  to: string,
  privateKey: string
): Promise<TransactionResult> {
  try {
    const contractHash = getContractHashFromEnv();
    // Convert tokenId to bytes (4 bytes, little endian)
    const tokenIdBytes = Buffer.alloc(4);
    tokenIdBytes.writeUInt32LE(tokenId, 0);
    const tokenIdHex = '0x' + tokenIdBytes.toString('hex');
    
    const script = buildInvocationScript(contractHash, 'transfer_product_nft', [
      tokenId,
      to,
    ]);
    return await signAndSendTransaction(script, privateKey);
  } catch (error: any) {
    return {
      txHash: '',
      success: false,
      error: parseNeoError(error),
    };
  }
}

/**
 * Admin transfer
 */
export async function adminTransfer(
  tokenId: number,
  to: string,
  privateKey: string
): Promise<TransactionResult> {
  try {
    const contractHash = getContractHashFromEnv();
    const script = buildInvocationScript(contractHash, 'admin_transfer', [tokenId, to]);
    return await signAndSendTransaction(script, privateKey);
  } catch (error: any) {
    return {
      txHash: '',
      success: false,
      error: parseNeoError(error),
    };
  }
}

/**
 * Get token owner
 */
export async function getTokenOwner(tokenId: number): Promise<string | null> {
  try {
    const contractHash = getContractHashFromEnv();
    const result = await invokeContractMethod(contractHash, 'get_product_current_owner', [tokenId]);
    
    if (result.success && result.result) {
      // Convert result to address string
      if (typeof result.result === 'string') {
        return result.result;
      }
      // If it's bytes, convert to hex string
      if (Buffer.isBuffer(result.result)) {
        return '0x' + result.result.toString('hex');
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting token owner:', error);
    return null;
  }
}

/**
 * Get balance of owner
 */
export async function balanceOf(owner: string): Promise<number> {
  try {
    const contractHash = getContractHashFromEnv();
    const result = await invokeContractMethod(contractHash, 'balanceOf', [owner]);
    
    if (result.success && result.result !== undefined) {
      return Number(result.result);
    }
    return 0;
  } catch (error) {
    console.error('Error getting balance:', error);
    return 0;
  }
}

/**
 * Get all tokens owned by address
 */
export async function tokensOf(owner: string): Promise<number[]> {
  try {
    const contractHash = getContractHashFromEnv();
    const result = await invokeContractMethod(contractHash, 'tokensOf', [owner]);
    
    if (result.success && Array.isArray(result.result)) {
      // Convert bytes array to token IDs
      return result.result.map((tokenBytes: any) => {
        if (typeof tokenBytes === 'string') {
          // If it's hex string, convert to number
          const bytes = Buffer.from(tokenBytes.slice(2), 'hex');
          return bytes.readUInt32LE(0);
        }
        return 0;
      }).filter((id: number) => id > 0);
    }
    return [];
  } catch (error) {
    console.error('Error getting tokens:', error);
    return [];
  }
}

/**
 * Get token properties
 */
export async function getTokenProperties(tokenId: number): Promise<TokenMetadata | null> {
  try {
    const contractHash = getContractHashFromEnv();
    // Convert tokenId to bytes for NEP-11 properties method
    const tokenIdBytes = Buffer.alloc(4);
    tokenIdBytes.writeUInt32LE(tokenId, 0);
    const tokenIdHex = '0x' + tokenIdBytes.toString('hex');
    
    const result = await invokeContractMethod(contractHash, 'properties', [tokenIdHex]);
    
    if (result.success && result.result) {
      const props = result.result as any;
      return {
        owner: props.owner || '',
        uri: props.uri || '',
        batch_number: props.batch_number || '',
        expiry_date: Number(props.expiry_date || 0),
        expired: Boolean(props.expired || false),
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting token properties:', error);
    return null;
  }
}

/**
 * Get total supply
 */
export async function totalSupply(): Promise<number> {
  try {
    const contractHash = getContractHashFromEnv();
    const result = await invokeContractMethod(contractHash, 'totalSupply', []);
    
    if (result.success && result.result !== undefined) {
      return Number(result.result);
    }
    return 0;
  } catch (error) {
    console.error('Error getting total supply:', error);
    return 0;
  }
}

/**
 * Check if product is expired
 */
export async function isProductExpired(tokenId: number): Promise<boolean> {
  try {
    const contractHash = getContractHashFromEnv();
    const result = await invokeContractMethod(contractHash, 'is_product_expired', [tokenId]);
    
    if (result.success && result.result !== undefined) {
      return Boolean(result.result);
    }
    return false;
  } catch (error) {
    console.error('Error checking expiry:', error);
    return false;
  }
}
