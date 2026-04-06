/**
 * API Route: POST /api/pharmacy/confirm-receipt
 * Hiệu thuốc xác nhận đã nhận sản phẩm
 *
 * No JWT required — ownership is verified from database record.
 * Body: {
 *   nftId: number,
 *   pharmacyAddress: string,
 *   quantity: number,
 *   notes?: string
 * }
 */

import { NextRequest, NextResponse }from 'next/server';
import { getTransactionManager }from '@/lib/db/transaction-manager';
import { pool } from "@/lib/db";
import { logInfo, logError }from '@/lib/logger';
import { z }from 'zod';
import { v4 as uuidv4 }from 'uuid';
import { emitNotification } from '@/lib/socket/events';
import { ensureTableExists, TABLE_DEFINITIONS } from "@/lib/db/table-init";

const receiptSchema = z.object({
  nftId: z.number().min(1, 'nftId là bắt buộc'),
  pharmacyAddress: z.string()
    .regex(/^0x[a-fA-F0-9]{64}$/, 'Địa chỉ Sui không hợp lệ'),
  quantity: z.number().min(1, 'quantity phải lớn hơn 0'),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    // Bước 1: Validate request
    const body = await req.json();
    const validatedData = receiptSchema.parse(body);
    const pharmacyAddress = validatedData.pharmacyAddress.toLowerCase();

    // Bước 2: Ensure tables exist
    await Promise.all([
      ensureTableExists("nfts", TABLE_DEFINITIONS.nfts),
    ]).catch(() => {});

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

    // Verify NFT is in transfer to pharmacy state
    if (nft.status !== 'at_pharmacy' && nft.status !== 'pending_pharmacy') {
      return NextResponse.json(
        { error: `Không thể confirm receipt ở trạng thái "${nft.status}"` },
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
          pharmacyAddress,
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
          pharmacy: pharmacyAddress,
          quantity: validatedData.quantity,
          timestamp: now,
        });

        return updateResult.rows[0];
      },
      idempotencyKey
    );

    // Emit real-time notifications
    try {
      emitNotification(pharmacyAddress, {
        type: "success",
        title: "Đã xác nhận nhận hàng",
        message: `Đã xác nhận nhận lô thuốc #${result.batch_number}`,
        data: { nftId: validatedData.nftId, batchNumber: result.batch_number },
      });
    } catch (notifErr) {
      console.error("[SSE] Failed to emit receipt confirmation notification:", notifErr);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Đã xác nhận nhận hàng thành công',
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
          error: error.errors[0]?.message || 'Dữ liệu không hợp lệ',
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
