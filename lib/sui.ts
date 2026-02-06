import { Connection, JsonRpcProvider, Ed25519Keypair, RawSigner, TransactionBlock } from "@mysten/sui.js";
import { fromB64 } from "@mysten/sui.js/utils";

/**
 * Singleton helper to interact with Sui RPC from server (API routes / scripts).
 * Uses a private key (base64) stored in env SUI_PRIVATE_KEY for signing.
 * NOTE: In production you might replace this with walletless flow (client-side signing).
 */

const connection = new Connection({ fullnode: process.env.SUI_RPC_URL || "https://fullnode.testnet.sui.io" });
export const provider = new JsonRpcProvider(connection);

let signer: RawSigner | null = null;

export const getSigner = (): RawSigner => {
  if (signer) return signer;
  const privateKeyB64 = process.env.SUI_PRIVATE_KEY;
  if (!privateKeyB64) {
    throw new Error("SUI_PRIVATE_KEY env not set");
  }
  const keypair = Ed25519Keypair.fromSecretKey(fromB64(privateKeyB64));
  signer = new RawSigner(keypair, provider);
  return signer;
};

/**
 * Build a TransactionBlock and execute, returning transaction digest.
 */
export async function executeTx(tx: TransactionBlock) {
  const _signer = getSigner();
  const res = await _signer.signAndExecuteTransactionBlock({ transactionBlock: tx });
  return res.digest;
}
