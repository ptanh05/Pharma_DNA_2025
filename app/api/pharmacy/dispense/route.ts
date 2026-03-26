/**
 * API Route: POST /api/pharmacy/dispense
 * Hiệu thuốc phát hành sản phẩm cho khách hàng
 *
 * Headers: Authorization: Bearer <JWT_TOKEN>
 * Body: {
 *   nftId: number,
 *   customerId: string,
 *   dispensedQuantity: number,
 *   prescriptionId?: string
 * }
 */

import { NextRequest, NextResponse }from 'next/server';
import { authorizeRole, UnauthorizedError, ForbiddenError }from '@/lib/middleware/auth';
import { getTransactionManager }from '@/lib/db/transaction-manager';
import { pool } from "@/lib/db";
import { logInfo, logError, logEvent }from '@/lib/logger';
import { z }from 'zod';
import { v4 as uuidv4 }from 'uuid';

// Validation schema
const dispenseSchema = z.object({
  nftId: z.number().min(1, 'nftId là bắt buộc'),
  customerId: z.string().min(1, 'customerId là bắt buộc'),
  dispensedQuantity: z.number().min(1, 'dispensedQuantity phải lớn hơn 0'),
  prescriptionId: z.string().optional(),
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
          { error: 'Chỉ Pharmacy mới có thể dispense' },
          { status: 403 }
        );
      }
      throw error;
    }

    // Bước 2: Validate request
    const body = await req.json();
    const validatedData = dispenseSchema.parse(body);

    // Bước 3: Lấy NFT từ database
    const nftQuery = `
      SELECT id, batch_number, status, quantity
      FROM nfts
      WHERE id = $1 AND pharmacy_address = $2
      LIMIT 1
    `;
    const nftResult = await pool.query(nftQuery, [
      validatedData.nftId,
      user.address.toLowerCase(),
    ]);

    if (!nftResult.rows.length) {
      return NextResponse.json(
        { error: 'NFT không tìm thấy hoặc bạn không có quyền' },
        { status: 404 }
      );
    }

    const nft = nftResult.rows[0];

    // Verify status
    if (nft.status !== 'at_pharmacy') {
      return NextResponse.json(
        { error: 'Sản phẩm không ở trạng thái sẵn sàng để phát hành' },
        { status: 400 }
      );
    }

    // Verify quantity
    if ((nft.quantity || 0) < validatedData.dispensedQuantity) {
      return NextResponse.json(
        { error: 'Số lượng không đủ để phát hành' },
        { status: 400 }
      );
    }

    // Bước 4: Lưu dispense record
    const idempotencyKey = `dispense-${validatedData.nftId}-${validatedData.customerId}-${Date.now()}`;
    const txManager = getTransactionManager();

    const result = await txManager.executeWithRecovery(
      async () => {
        const now = new Date().toISOString();
        const dispenseId = uuidv4();

        // Thêm dispense record
        const dispenseQuery = `
          INSERT INTO dispensing_records (
            id,
            nft_id,
            pharmacy_address,
            customer_id,
            quantity,
            prescription_id,
            dispensed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `;

        const dispenseResult = await pool.query(dispenseQuery, [
          dispenseId,
          validatedData.nftId,
          user.address.toLowerCase(),
          validatedData.customerId,
          validatedData.dispensedQuantity,
          validatedData.prescriptionId || null,
          now,
        ]);

        // Cập nhật NFT status
        const remainingQuantity = (nft.quantity || 0) - validatedData.dispensedQuantity;
        const newStatus = remainingQuantity <= 0 ? 'dispensed' : 'at_pharmacy';

        const updateQuery = `
          UPDATE nfts
          SET status = $1,
              quantity = $2,
              last_dispensed_at = $3,
              updated_at = $3
          WHERE id = $4
          RETURNING *
        `;

        const updateResult = await pool.query(updateQuery, [
          newStatus,
          Math.max(0, remainingQuantity),
          now,
          validatedData.nftId,
        ]);

        logInfo('Product dispensed', {
          requestId,
          dispenseId,
          nftId: validatedData.nftId,
          customerId: validatedData.customerId,
          quantity: validatedData.dispensedQuantity,
          pharmacy: user.address,
          timestamp: now,
        });

        // Log business event
        logEvent({
          requestId,
          event: 'PRODUCT_DISPENSED',
          userId: validatedData.customerId,
          role: 'CONSUMER',
          details: {
            nftId: validatedData.nftId,
            quantity: validatedData.dispensedQuantity,
            pharmacy: user.address,
          },
          severity: 'info',
        });

        return {
          dispenseRecord: dispenseResult.rows[0],
          nft: updateResult.rows[0],
        };
      },
      idempotencyKey
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Sản phẩm đã được phát hành thành công',
        data: {
          dispenseRecord: result.dispenseRecord,
          nft: result.nft,
          dispensedAt: new Date().toISOString(),
        },
      },
      { status: 200 }
    );

  }catch (error: any) {
    logError('Dispense endpoint error', error, { requestId });

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
        error: error.message || 'Lỗi khi phát hành sản phẩm',
      },
      { status: 500 }
    );
  }
}
