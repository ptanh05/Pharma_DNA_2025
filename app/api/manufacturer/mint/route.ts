import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { mintProductNFT } from '@/lib/blockchain/contract';
import { parseSuiError, getSuiErrorHints } from '@/lib/blockchain/errors-sui';
import { getExplorerTxUrl } from '@/lib/blockchain/contract';
import { z } from 'zod';

const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

const mintSchema = z.object({
  ipfsHash: z.string().min(1, "ipfsHash là bắt buộc"),
  account: z.string().min(1, "account là bắt buộc").regex(/^0x[a-fA-F0-9]{64}$/, "Địa chỉ Sui không hợp lệ"),
  batchNumber: z.string().optional(),
  expiryDate: z.number().optional(),
});

/**
 * POST /api/manufacturer/mint
 * Mint NFT on Sui blockchain
 *
 * Body: { ipfsHash: string, account: string, batchNumber?: string, expiryDate?: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedData = mintSchema.parse(body);

    const { ipfsHash, account, batchNumber, expiryDate } = validatedData;

    if (!OWNER_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'OWNER_PRIVATE_KEY không được cấu hình' },
        { status: 500 }
      );
    }

    // Default values if not provided
    const batch = batchNumber || `BATCH-${Date.now()}`;
    // Sui uses milliseconds for timestamps
    const expiry = expiryDate || Math.floor(Date.now()) + (365 * 24 * 60 * 60 * 1000); // 1 year from now in ms

    // Mint NFT on Sui blockchain
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
      `INSERT INTO nfts (name, status, created_at, manufacturer_address, ipfs_hash, batch_number, token_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        `NFT-${Date.now()}`,
        'minted',
        now,
        account.toLowerCase(),
        ipfsHash,
        batch,
        txResult.objectId || null, // Use objectId for Sui
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'NFT đã được mint thành công trên Sui blockchain!',
      nft: result.rows[0],
      transactionHash: txResult.digest,
      transactionDigest: txResult.digest, // Sui uses digest
      objectId: txResult.objectId, // Sui object ID
      explorerUrl: getExplorerTxUrl(txResult.digest),
      checkpoint: txResult.checkpoint,
    });
  } catch (error: any) {
    console.error('Mint NFT error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    const suiError = parseSuiError(error);
    const hints = getSuiErrorHints(error);

    return NextResponse.json(
      {
        error: 'Lỗi khi mint NFT',
        detail: suiError,
        hints,
      },
      { status: 500 }
    );
  }
}

