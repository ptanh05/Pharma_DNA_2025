import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { mintProductNFT } from '@/lib/blockchain/contract';
import { parseNeoError, getErrorHints } from '@/lib/blockchain/errors';
import { getExplorerTxUrl } from '@/lib/blockchain/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

/**
 * POST /api/manufacturer/mint
 * Mint NFT on Neo N3 blockchain
 * 
 * Body: { ipfsHash: string, account: string, batchNumber?: string, expiryDate?: number }
 */
export async function POST(req: NextRequest) {
  try {
    const { ipfsHash, account, batchNumber, expiryDate } = await req.json();
    
    if (!ipfsHash || !account) {
      return NextResponse.json(
        { error: 'Thiếu thông tin: ipfsHash và account là bắt buộc' },
        { status: 400 }
      );
    }

    if (!OWNER_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'OWNER_PRIVATE_KEY không được cấu hình' },
        { status: 500 }
      );
    }

    // Default values if not provided
    const batch = batchNumber || `BATCH-${Date.now()}`;
    const expiry = expiryDate || Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year from now

    // Mint NFT on Neo N3 blockchain
    const txResult = await mintProductNFT(
      ipfsHash,
      batch,
      expiry,
      OWNER_PRIVATE_KEY
    );

    if (!txResult.success) {
      throw new Error(txResult.error || 'Minting failed');
    }

    // Save to database
    const now = new Date().toISOString();
    const result = await pool.query(
      `INSERT INTO nfts (name, status, created_at, manufacturer_address, ipfs_hash, batch_number)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [`NFT-${Date.now()}`, 'minted', now, account.toLowerCase(), ipfsHash, batch]
    );

    return NextResponse.json({
      success: true,
      message: 'NFT đã được mint thành công trên Neo N3 blockchain!',
      nft: result.rows[0],
      transactionHash: txResult.txHash,
      explorerUrl: getExplorerTxUrl(txResult.txHash),
      blockNumber: txResult.blockNumber,
    });
  } catch (error: any) {
    console.error('Mint NFT error:', error);
    const neoError = parseNeoError(error);
    const hints = getErrorHints(error);
    
    return NextResponse.json(
      {
        error: 'Lỗi khi mint NFT',
        detail: neoError.message,
        code: neoError.code,
        hints,
      },
      { status: 500 }
    );
  }
}

