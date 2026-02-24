/**
 * API Route: POST /api/v1/pharmacy/confirm-receipt
 * Hiệu thuốc xác nhận đã nhận sản phẩm
 * 
 * Headers: Authorization: Bearer <JWT_TOKEN>
 * Body: {
 *   nftId: number,
 *   quantity: number,
 *   notes?: string
 * }
 */

import { NextRequest, NextResponse }from 'next/server';
import { authorizeRole, UnauthorizedError, ForbiddenError }from '@/lib/middleware/auth';
import { getTransactionManager }from '@/lib/db/transaction-manager';
import { pool }from '@/lib/db/connection';
import { logInfo, logError }from '@/lib/logger';
import { z }from 'zod';
import { v4 as uuidv4 }from 'uuid';

// Validation schema
const receiptSchema = z.object({
  nftId: z.number().min(1, 'nftId là bắt buộc'),
  quantity: z.number().min(1, 'quantity phải lớn hơn 0'),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    // Bước 1: Xác thực user (PHARMACY)
    let user;
    try {
      user = await authorizeRole(req, 'PHARMACY');
    }catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          { error: 'Bạn phải đăng nhập để tiếp tục' },
          { status: 401 }
        );
      }
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          { error: 'Chỉ Pharmacy mới có thể confirm receipt' },
          { status: 403 }
        );
      }
      throw error;
    }

    // Bước 2: Validate request
    const body = await req.json();
    const validatedData = receiptSchema.parse(body);

    // Bước 3: Lấy NFT từ database
    const nftQuery = `
      SELECT id, batch_number, distributor_address, status 
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

    // Verify status
    if (nft.status !== 'at_pharmacy' && nft.status !== 'minted') {
      return NextResponse.json(
        { error: 'Không thể confirm receipt cho sản phẩm này' },
        { status: 400 }
      );
    }

    // Bước 4: Cập nhật status
    const idempotencyKey = `receipt-${validatedData.nftId}-${Date.now()}`;
    const txManager = getTransactionManager();

    const result = await txManager.executeWithRecovery(
      async () => {
        const now = new Date().toISOString();

        // Cập nhật NFT status
        const updateQuery = `
          UPDATE nfts 
          SET pharmacy_address = $1,
              status = 'at_pharmacy',
              quantity = $2,
              receipt_notes = $3,
              receipt_confirmed_at = $4,
              updated_at = $4
          WHERE id = $5
          RETURNING *
        `;

        const updateResult = await pool.query(updateQuery, [
          user.address.toLowerCase(),
          validatedData.quantity,
          validatedData.notes || null,
          now,
          validatedData.nftId,
        ]);

        if (!updateResult.rows.length) {
          throw new Error('Failed to confirm receipt');
        }

        logInfo('Receipt confirmed', {
          requestId,
          nftId: validatedData.nftId,
          pharmacy: user.address,
          quantity: validatedData.quantity,
          timestamp: now,
        });

        return updateResult.rows[0];
      },
      idempotencyKey
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Đã xác nhận receipt thành công',
        data: {
          nft: result,
          confirmedAt: new Date().toISOString(),
        },
      },
      { status: 200 }
    );

  }catch (error: any) {
    logError('Confirm receipt endpoint error', error, { requestId });

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
        error: error.message || 'Lỗi khi confirm receipt',
      },
      { status: 500 }
    );
  }
}
