/**
 * API Route: POST /api/manufacturer/transfer-request
 * Nhà sản xuất gửi sản phẩm cho distributor hoặc pharmacy
 *
 * Headers: Authorization: Bearer <JWT_TOKEN>
 * Body: {
 *   nftId: number,
 *   recipientAddress: string,
 *   recipientRole: 'DISTRIBUTOR' | 'PHARMACY'
 * }
 */

import { NextRequest, NextResponse }from 'next/server';
import { authorizeRole, UnauthorizedError, ForbiddenError } from '@/lib/middleware/auth';
import { getTransactionManager }from '@/lib/db/transaction-manager';
import { transferProductNFT }from '@/lib/blockchain/contract';
import { pool } from "@/lib/db";
import { logInfo, logError, logBlockchain }from '@/lib/logger';
import { z }from 'zod';
import { v4 as uuidv4 }from 'uuid';

// Validation schema
const transferRequestSchema = z.object({
  nftId: z.number().min(1, 'nftId là bắt buộc'),
  recipientAddress: z.string().min(1, 'recipientAddress là bắt buộc'),
  recipientRole: z.enum(['DISTRIBUTOR', 'PHARMACY']),
});

const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    // Bước 1: Xác thực user (MANUFACTURER)
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
          { error: 'Chỉ Manufacturer mới có thể transfer' },
          { status: 403 }
        );
      }
      throw error;
    }

    // Bước 2: Validate request
    const body = await req.json();
    const validatedData = transferRequestSchema.parse(body);

    // Bước 3: Lấy NFT từ database
    const nftQuery = `
      SELECT id, batch_number, object_id, manufacturer_address, status
      FROM nfts
      WHERE id = $1
      LIMIT 1
    `;
    const nftResult = await pool.query(nftQuery, [validatedData.nftId]);

    if (!nftResult.rows.length) {
      return NextResponse.json(
        { error: 'NFT không tìm thấy' },
        { status: 404 }
      );
    }

    const nft = nftResult.rows[0];

    // Verify ownership
    if (nft.manufacturer_address !== user.address.toLowerCase()) {
      return NextResponse.json(
        { error: 'Bạn không sở hữu NFT này' },
        { status: 403 }
      );
    }

    // Bước 4: Tạo transfer transaction
    const idempotencyKey = `transfer-${validatedData.nftId}-${Date.now()}`;
    const txManager = getTransactionManager();

    const result = await txManager.executeWithRecovery(
      async () => {
        // 4a: Transfer on blockchain
        logInfo('Transferring NFT on blockchain', {
          requestId,
          nftId: validatedData.nftId,
          from: user.address,
          to: validatedData.recipientAddress,
        });

        // Use object_id for Sui blockchain transfer (fallback to batch_number if not set)
        const nftIdentifier = nft.object_id || nft.batch_number;
        const blockchainResult = await transferProductNFT(
          nftIdentifier,
          validatedData.recipientAddress,
          OWNER_PRIVATE_KEY
        );

        if (!blockchainResult.success) {
          throw new Error(`Blockchain transfer failed: ${blockchainResult.error}`);
        }

        // 4b: Update database
        const now = new Date().toISOString();
        const columnName = validatedData.recipientRole === 'DISTRIBUTOR'
          ? 'distributor_address'
          : 'pharmacy_address';

        const updateQuery = `
          UPDATE nfts
          SET ${columnName} = $1,
              status = $2,
              updated_at = $3
          WHERE id = $4
          RETURNING *
        `;

        const newStatus = validatedData.recipientRole === 'DISTRIBUTOR'
          ? 'at_distributor'
          : 'at_pharmacy';

        const updateResult = await pool.query(updateQuery, [
          validatedData.recipientAddress.toLowerCase(),
          newStatus,
          now,
          validatedData.nftId,
        ]);

        if (!updateResult.rows.length) {
          throw new Error('Failed to update NFT status');
        }

        logInfo('NFT transferred successfully', {
          requestId,
          nftId: validatedData.nftId,
          status: newStatus,
          recipient: validatedData.recipientAddress,
        });

        return {
          nft: updateResult.rows[0],
          blockchain: blockchainResult,
        };
      },
      idempotencyKey
    );

    // Log blockchain event
    logBlockchain({
      requestId,
      action: `TRANSFER_TO_${validatedData.recipientRole}`,
      digest: result.blockchain.digest,
      status: 'success',
      duration: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        success: true,
        message: `NFT đã được chuyển cho ${validatedData.recipientRole}`,
        data: {
          nft: result.nft,
          transactionDigest: result.blockchain.digest,
        },
      },
      { status: 200 }
    );

  }catch (error: any) {
    logError('Transfer endpoint error', error, { requestId });

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

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Lỗi khi transfer NFT',
      },
      { status: 500 }
    );
  }
}
