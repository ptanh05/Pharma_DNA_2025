import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { saveNFTRequestSchema } from '@/lib/validation/schemas';
import { validateAndSanitizeRequest, validationErrorResponse } from '@/lib/validation/middleware';
import { emitNFTMinted } from '@/lib/socket/events';
import { withRateLimit, rateLimitConfigs } from '@/lib/middleware/rate-limit-wrapper';
import { trackAPI } from '@/lib/utils/api-helpers';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * POST /api/manufacturer/save-nft
 * Save NFT to database after client-side minting
 * 
 * Body: { 
 *   objectId: string, 
 *   ipfsHash: string, 
 *   account: string, 
 *   batchNumber: string,
 *   transactionDigest: string 
 * }
 */
async function handlePOST(req: NextRequest) {
  return trackAPI("manufacturer:save-nft", async () => {
    try {
      const body = await req.json();
    
    // Validate and sanitize input
    const validation = validateAndSanitizeRequest(saveNFTRequestSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }

    const { objectId, ipfsHash, account, batchNumber, transactionDigest } = validation.data;

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
        batchNumber,
        objectId, // Sui object ID
      ]
    );

    const nft = result.rows[0];

    // Emit socket event for real-time update
    try {
      emitNFTMinted({
        objectId,
        batchNumber,
        manufacturerAddress: account,
        transactionDigest,
      });
    } catch (socketError) {
      console.error("Failed to emit socket event:", socketError);
    }

    return NextResponse.json({
      success: true,
      message: 'NFT đã được lưu vào database thành công!',
      nft,
      transactionDigest,
    });
  } catch (error: any) {
    console.error('Save NFT error:', error);
    
    return NextResponse.json(
      {
        error: 'Lỗi khi lưu NFT vào database',
        detail: error.message || String(error),
      },
      { status: 500 }
    );
    }
  });
}

// Apply rate limiting
export const POST = withRateLimit(handlePOST, rateLimitConfigs.write);

