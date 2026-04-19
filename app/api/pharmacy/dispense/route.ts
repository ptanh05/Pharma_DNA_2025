/**
 * API Route: POST /api/pharmacy/dispense
 * Hiệu thuốc phát hành sản phẩm cho khách hàng
 *
 * No JWT required — ownership is verified from database record.
 * Body: {
 *   nftId: number,
 *   pharmacyAddress: string,
 *   customerId: string,
 *   dispensedQuantity: number,
 *   prescriptionId?: string
 * }
 */

import { NextRequest, NextResponse }from 'next/server';
import { getTransactionManager }from '@/lib/db/transaction-manager';
import { pool } from "@/lib/db";
import { logInfo, logError, logEvent }from '@/lib/logger';
import { z }from 'zod';
import { v4 as uuidv4 }from 'uuid';
import { ensureTableExists, TABLE_DEFINITIONS } from "@/lib/db/table-init";

const dispenseSchema = z.object({
  nftId: z.number().min(1, 'nftId là bắt buộc'),
  pharmacyAddress: z.string()
    .regex(/^0x[a-fA-F0-9]{64}$/, 'Địa chỉ Sui không hợp lệ'),
  customerId: z.string().min(1, 'customerId là bắt buộc'),
  dispensedQuantity: z.number().min(1, 'dispensedQuantity phải lớn hơn 0'),
  prescriptionId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    // Bước 1: Validate request
    const body = await req.json();
    const validatedData = dispenseSchema.parse(body);
    const pharmacyAddress = validatedData.pharmacyAddress.toLowerCase();

    // Bước 2: Ensure tables exist
    await Promise.all([
      ensureTableExists("nfts", TABLE_DEFINITIONS.nfts),
      ensureTableExists("dispensing_records", TABLE_DEFINITIONS.dispensing_records),
    ]).catch(() => {});

    // Bước 3: Lấy NFT từ database và verify ownership
    const nftQuery = `
      SELECT id, batch_number, status, quantity
      FROM nfts
      WHERE id = $1 AND pharmacy_address = $2
      LIMIT 1
    `;
    const nftResult = await pool.query(nftQuery, [
      validatedData.nftId,
      pharmacyAddress,
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
          pharmacyAddress,
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
          pharmacy: pharmacyAddress,
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
            pharmacy: pharmacyAddress,
          },
          severity: 'info',
        });

        return {
          dispenseRecord: dispenseResult.rows[0],
          nft: updateResult.rows[0],
          confirmedAt: now,
        };
      },
      idempotencyKey
    );

    // Record milestone for activity feed + chart
    try {
      await pool.query(
        `INSERT INTO milestones (nft_id, type, description, location, timestamp, actor_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          validatedData.nftId,
          'phát hành',
          `Đã phát hành ${validatedData.dispensedQuantity} sản phẩm cho khách #${validatedData.customerId}`,
          null,
          result.confirmedAt,
          pharmacyAddress,
        ]
      );
    } catch (msErr) {
      // Non-critical
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Sản phẩm đã được phát hành thành công',
        data: {
          dispenseRecord: result.dispenseRecord,
          nft: result.nft,
          dispensedAt: result.confirmedAt,
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
          error: error.errors[0]?.message || 'Dữ liệu không hợp lệ',
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
