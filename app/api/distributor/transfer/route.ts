/**
 * POST /api/distributor/transfer
 * Transfer NFT from distributor → pharmacy
 * Uses client-side wallet signing (user signs with their own wallet).
 *
 * Body: { nftId: number, pharmacyAddress: string, transactionDigest: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { authorizeRole, UnauthorizedError, ForbiddenError } from '@/lib/middleware/auth';
import { pool } from '@/lib/db';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';

const transferSchema = z.object({
  nftId: z.number().min(1),
  pharmacyAddress: z.string().min(1, 'Pharmacy address is required'),
  transactionDigest: z.string().min(1, 'Transaction digest is required'),
});

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let user;
    try {
      user = await authorizeRole(req, 'DISTRIBUTOR');
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json({ error: 'Bạn phải đăng nhập để tiếp tục' }, { status: 401 });
      }
      if (error instanceof ForbiddenError) {
        return NextResponse.json({ error: 'Chỉ Distributor mới có thể thực hiện' }, { status: 403 });
      }
      throw error;
    }

    const body = await req.json();
    const { nftId, pharmacyAddress, transactionDigest } = transferSchema.parse(body);

    // Verify NFT belongs to this distributor
    const nftResult = await pool.query(
      `SELECT id, object_id, batch_number, status, distributor_address
       FROM nfts WHERE id = $1 LIMIT 1`,
      [nftId]
    );

    if (!nftResult.rows.length) {
      return NextResponse.json({ error: 'NFT không tìm thấy' }, { status: 404 });
    }

    const nft = nftResult.rows[0];
    if (nft.distributor_address !== user.address.toLowerCase()) {
      return NextResponse.json({ error: 'Bạn không sở hữu NFT này' }, { status: 403 });
    }

    if (nft.status !== 'at_distributor') {
      return NextResponse.json({ error: 'NFT không ở trạng thái sẵn sàng để chuyển' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Update database — NFT đã được chuyển trên blockchain bởi distributor's wallet
    const updateResult = await pool.query(
      `UPDATE nfts
       SET pharmacy_address = $1,
           status = 'at_pharmacy',
           transaction_digest = $2,
           updated_at = $3,
           transferred_at = $3
       WHERE id = $4
       RETURNING *`,
      [pharmacyAddress.toLowerCase(), transactionDigest, now, nftId]
    );

    // Update transfer request
    try {
      await pool.query(
        `UPDATE transfer_requests_v2
         SET status = 'approved', updated_at = $1
         WHERE nft_id = $2 AND pharmacy_address = $3
         LIMIT 1`,
        [now, nftId, pharmacyAddress.toLowerCase()]
      );
    } catch {}

    // Record milestone
    try {
      await pool.query(
        `INSERT INTO milestones (nft_id, type, description, location, timestamp, actor_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          nftId,
          'giao hàng',
          `Đã giao lô thuốc #${nft.batch_number} cho nhà thuốc`,
          null,
          now,
          user.address.toLowerCase(),
        ]
      );
    } catch (msErr) {
      logger.warn('API_DISTRIBUTOR_TRANSFER', 'Failed to record milestone', msErr);
    }

    logger.info('DISTRIBUTOR_TRANSFER', 'NFT transferred to pharmacy via wallet signing', {
      nftId,
      distributor: user.address,
      pharmacy: pharmacyAddress,
      digest: transactionDigest,
    });

    return NextResponse.json({
      success: true,
      message: 'Đã chuyển lô thành công',
      data: { nft: updateResult.rows[0], transactionDigest },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ', details: error.errors }, { status: 400 });
    }
    logger.error('API_DISTRIBUTOR_TRANSFER', 'Transfer failed', error);
    return NextResponse.json({ error: error.message || 'Lỗi khi transfer' }, { status: 500 });
  }
}
