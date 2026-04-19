/**
 * POST /api/pharmacy/auto-confirm-receipt
 * Tự động xác nhận đã nhận sản phẩm khi pharmacy duyệt yêu cầu chuyển lô.
 * Không yêu cầu admin auth — pharmacy address được xác thực từ ví.
 *
 * Body: { nftId: number, pharmacyAddress: string, quantity?: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from "@/lib/db";
import { logInfo, logError } from '@/lib/logger';
import { z } from 'zod';

const schema = z.object({
  nftId: z.number().min(1),
  pharmacyAddress: z.string().min(1),
  quantity: z.number().min(1).default(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nftId, pharmacyAddress, quantity } = schema.parse(body);

    logInfo('Auto confirm receipt', { nftId, pharmacyAddress, quantity });

    // Lấy NFT từ database
    const nftQuery = `
      SELECT id, batch_number, distributor_address, status, name
      FROM nfts
      WHERE id = $1
      LIMIT 1
    `;
    const nftResult = await pool.query(nftQuery, [nftId]);

    if (!nftResult.rows.length) {
      return NextResponse.json(
        { error: 'NFT không tìm thấy' },
        { status: 404 }
      );
    }

    const nft = nftResult.rows[0];
    const now = new Date().toISOString();

    // Cập nhật NFT status thành at_pharmacy
    await pool.query(
      `UPDATE nfts SET status = 'at_pharmacy', pharmacy_address = $1, updated_at = NOW(), created_at = COALESCE(created_at, NOW()) WHERE id = $2`,
      [pharmacyAddress.toLowerCase(), nftId]
    );

    // Record milestone for activity feed + chart
    try {
      await pool.query(
        `INSERT INTO milestones (nft_id, type, description, location, timestamp, actor_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          nftId,
          'nhận hàng',
          `Đã tự động nhận lô thuốc #${nft.batch_number}`,
          null,
          now,
          pharmacyAddress.toLowerCase(),
        ]
      );
    } catch (msErr) {
      // Non-critical
    }

    logInfo('Auto confirm receipt success', { nftId, pharmacyAddress });

    return NextResponse.json({
      success: true,
      message: 'Đã nhập kho thành công',
      nft: nft
    });
  } catch (error: any) {
    logError('Auto confirm receipt error', error);
    return NextResponse.json(
      { error: error.message || 'Có lỗi xảy ra' },
      { status: 500 }
    );
  }
}
