/**
 * API Route: POST /api/manufacturer/mint
 * Mint NFT mới trên Sui blockchain
 *
 * Yêu Cầu:
 * - User phải có role MANUFACTURER
 * - ipfsHash: IPFS hash của metadata
 * - batchNumber: Mã lô sản phẩm (tuỳ chọn)
 * - expiryDate: Ngày hết hạn (tuỳ chọn)
 */

import { NextRequest, NextResponse }from 'next/server';
import { getTransactionManager }from '@/lib/db/transaction-manager';
import { authorizeRole, UnauthorizedError, ForbiddenError }from '@/lib/middleware/auth';
import { mintProductNFT }from '@/lib/blockchain/contract';
import { pool } from "@/lib/db";
import { z }from 'zod';

// Validation schema
const mintRequestSchema = z.object({
  ipfsHash: z.string().min(1, 'ipfsHash là bắt buộc'),
  batchNumber: z.string().optional(),
  expiryDate: z.number().optional(),
  productName: z.string().optional(),
});

const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

export async function POST(req: NextRequest) {
  try {
    // Bước 1: Xác thực user
    let user;
    try {
      user = await authorizeRole(req, 'MANUFACTURER');
    }catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          { error: 'Bạn phải đăng nhập để tiếp tục' },
          { status: 401 }
        );
      }
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          { error: 'Chỉ Manufacturer mới có thể mint NFT' },
          { status: 403 }
        );
      }
      throw error;
    }

    // Bước 2: Validate request body
    const body = await req.json();
    const validatedData = mintRequestSchema.parse(body);

    if (!OWNER_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'OWNER_PRIVATE_KEY chưa được cấu hình' },
        { status: 500 }
      );
    }

    // Bước 3: Chuẩn bị dữ liệu
    const batchNumber = validatedData.batchNumber || `BATCH-${Date.now()}`;
    const productName = validatedData.productName || `PharmaNFT-${Date.now()}`;
    const expiryDate = validatedData.expiryDate || Date.now() + 365 * 24 * 60 * 60 * 1000;

    // Tạo idempotency key để tránh duplicate
    const idempotencyKey = `mint-${user.address}-${batchNumber}-${Date.now()}`;

    // Bước 4: Thực thi mint operation với transaction manager
    const txManager = getTransactionManager();

    const result = await txManager.executeWithRecovery(
      async () => {
        // 4a: Mint NFT trên blockchain
        console.log('[MintAPI] Minting NFT on blockchain...');
        const blockchainResult = await mintProductNFT(
          validatedData.ipfsHash,
          batchNumber,
          expiryDate,
          OWNER_PRIVATE_KEY
        );

        if (!blockchainResult.success) {
          throw new Error(`Blockchain mint failed: ${blockchainResult.error}`);
        }

        console.log(`[MintAPI] Blockchain mint successful, digest: ${blockchainResult.digest}`);

        // 4b: Lưu vào database
        console.log('[MintAPI] Saving to database...');
        const now = new Date().toISOString();
        const dbResult = await pool.query(
          `INSERT INTO nfts (
            name,
            status,
            created_at,
            manufacturer_address,
            ipfs_hash,
            batch_number,
            token_id,
            object_id,
            transaction_digest
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id, *`,
          [
            productName,
            'minted',
            now,
            user.address.toLowerCase(),
            validatedData.ipfsHash,
            batchNumber,
            blockchainResult.objectId || null,
            blockchainResult.objectId || null,
            blockchainResult.digest,
          ]
        );

        if (!dbResult.rows.length) {
          throw new Error('Failed to save NFT to database');
        }

        console.log(`[MintAPI] Database save successful, NFT ID: ${dbResult.rows[0].id}`);

        return {
          nft: dbResult.rows[0],
          blockchain: blockchainResult,
        };
      },
      idempotencyKey
    );

    // Bước 5: Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'NFT đã được mint thành công!',
        data: {
          nft: result.nft,
          transactionHash: result.blockchain.digest,
          objectId: result.blockchain.objectId,
          explorerUrl: `https://suiexplorer.com/txblock/${result.blockchain.digest}`,
        },
      },
      { status: 201 }
    );
  }catch (error: any) {
    console.error('[MintAPI] Error:', error);

    // Handle validation errors
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

    // Handle known errors
    if (error.message?.includes('INSUFFICIENT_GAS')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Không đủ gas để mint NFT',
        },
        { status: 400 }
      );
    }

    // Generic error
    let errorMessage = error.message || 'Lỗi khi mint NFT';
    let httpStatus = 500;

    // Check for blockchain network errors
    const errorLower = errorMessage.toLowerCase();
    if (errorLower.includes('502') || errorLower.includes('503') ||
        errorLower.includes('timeout') || errorLower.includes('network') ||
        errorLower.includes('bad gateway') || errorLower.includes('connection')) {
      errorMessage = 'Sui blockchain RPC server đang bận hoặc tạm thời ngưng hoạt động. Vui lòng thử lại sau vài giây.';
      httpStatus = 503;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: httpStatus }
    );
  }
}
