import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';

/**
 * Singleton helper to interact with Sui RPC from server (API routes / scripts).
 * Uses a private key stored in env SUI_PRIVATE_KEY for signing.
 * NOTE: In production you might replace this with walletless flow (client-side signing).
 */

const rpcUrl = process.env.SUI_RPC_URL || getFullnodeUrl('testnet');
export const provider = new SuiClient({ url: rpcUrl });

let signer: Ed25519Keypair | null = null;

export const getSigner = (): Ed25519Keypair => {
  if (signer) return signer;
  const privateKey = process.env.SUI_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("SUI_PRIVATE_KEY env not set");
  }
  // Handle both base64 and suiprivkey1 formats
  if (privateKey.startsWith('suiprivkey1')) {
    const { secretKey } = decodeSuiPrivateKey(privateKey);
    signer = Ed25519Keypair.fromSecretKey(secretKey);
  } else {
    signer = Ed25519Keypair.fromSecretKey(privateKey);
  }
  return signer;
};

/**
 * Build a TransactionBlock and execute, returning transaction digest.
 */
export async function executeTx(tx: TransactionBlock) {
  const _signer = getSigner();
  const result = await provider.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    signer: _signer,
    options: { showEffects: true, showObjectChanges: true },
  });
  return result.digest;
}
