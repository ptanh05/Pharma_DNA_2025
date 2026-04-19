/**
 * POST /api/distributor/transfer-request
 * Distributor gửi yêu cầu chuyển lô đến pharmacy — không cần JWT.
 * Distributor được xác thực qua ví (wallet address trong header).
 *
 * Body: { nft_id, pharmacy_address, transfer_note? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { emitNotification } from '@/lib/socket/events';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';
import { ensureTableExists, TABLE_DEFINITIONS } from '@/lib/db/table-init';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  nft_id: z.number().int().positive(),
  pharmacy_address: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Địa chỉ pharmacy không hợp lệ'),
  transfer_note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const distributorAddress = req.headers.get('x-distributor-address');
    if (!distributorAddress) {
      return NextResponse.json({ error: 'Thiếu x-distributor-address header' }, { status: 400 });
    }

    const body = await req.json();
    const { nft_id, pharmacy_address, transfer_note } = requestSchema.parse(body);
    const distAddr = distributorAddress.toLowerCase();

    // Verify NFT belongs to this distributor
    const nftResult = await pool.query(
      `SELECT id, batch_number, object_id, distributor_address, status
       FROM nfts WHERE id = $1 LIMIT 1`,
      [nft_id]
    );

    if (!nftResult.rows.length) {
      return NextResponse.json({ error: 'NFT không tìm thấy' }, { status: 404 });
    }

    const nft = nftResult.rows[0];

    if (nft.distributor_address !== distAddr) {
      return NextResponse.json({ error: 'Bạn không sở hữu NFT này' }, { status: 403 });
    }

    if (nft.status !== 'at_distributor') {
      return NextResponse.json({ error: 'NFT không ở trạng thái sẵn sàng để chuyển' }, { status: 400 });
    }

    // Ensure transfer_requests_v2 table exists
    try {
      await ensureTableExists('transfer_requests_v2', TABLE_DEFINITIONS.transfer_requests_v2);
    } catch {}

    // Insert transfer request
    const now = new Date().toISOString();
    let result;
    try {
      result = await pool.query(
        `INSERT INTO transfer_requests_v2
           (nft_id, distributor_address, pharmacy_address, transfer_note, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'pending', $5, $5)
         RETURNING *`,
        [nft_id, distAddr, pharmacy_address.toLowerCase(), transfer_note || null, now]
      );
    } catch (insertErr: any) {
      // Table may not exist — try original table
      try {
        result = await pool.query(
          `INSERT INTO transfer_requests
             (nft_id, distributor_address, pharmacy_address, transfer_note, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'pending', $5, $5)
           RETURNING *`,
          [nft_id, distAddr, pharmacy_address.toLowerCase(), transfer_note || null, now]
        );
      } catch {
        return NextResponse.json({ error: 'Không thể tạo yêu cầu chuyển lô' }, { status: 500 });
      }
    }

    // Emit notification for pharmacy
    try {
      emitNotification(pharmacy_address.toLowerCase(), {
        type: 'info',
        title: 'Yêu cầu nhận lô thuốc',
        message: `Nhà phân phối muốn chuyển lô #${nft.batch_number} cho bạn`,
        data: { nftId: nft_id, batchNumber: nft.batch_number },
      });
    } catch (notifErr) {
      logger.warn('API_DISTRIBUTOR', 'Failed to emit notification', notifErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Đã gửi yêu cầu chuyển lô',
      data: result.rows[0],
    }, { status: 201 });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    logger.error('API_DISTRIBUTOR', 'POST transfer-request error', error);
    return NextResponse.json({ success: false, error: error.message || 'Lỗi khi tạo yêu cầu' }, { status: 500 });
  }
}
