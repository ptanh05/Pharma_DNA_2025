/**
 * POST /api/manufacturer/transfer
 * Transfer NFT from manufacturer → distributor
 * Uses client-side wallet signing (user signs with their own wallet).
 *
 * Body: { nftId: number, distributorAddress: string, transactionDigest: string }
 *   - nftId: Database ID của NFT
 *   - distributorAddress: Địa chỉ distributor nhận
 *   - transactionDigest: Blockchain digest từ wallet signing (sau khi user ký thành công)
 */
import { NextRequest, NextResponse } from 'next/server';
import { authorizeRole, UnauthorizedError, ForbiddenError } from '@/lib/middleware/auth';
import { pool } from '@/lib/db';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';

const transferSchema = z.object({
  nftId: z.number().min(1),
  distributorAddress: z.string().min(1, 'Distributor address is required'),
  transactionDigest: z.string().min(1, 'Transaction digest is required'),
});

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Xác thực manufacturer qua JWT
    let user;
    try {
      user = await authorizeRole(req, 'MANUFACTURER');
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json({ error: 'Bạn phải đăng nhập để tiếp tục' }, { status: 401 });
      }
      if (error instanceof ForbiddenError) {
        return NextResponse.json({ error: 'Chỉ Manufacturer mới có thể thực hiện' }, { status: 403 });
      }
      throw error;
    }

    const body = await req.json();
    const { nftId, distributorAddress, transactionDigest } = transferSchema.parse(body);

    // Xác minh NFT thuộc về manufacturer này
    const nftResult = await pool.query(
      `SELECT id, object_id, batch_number, status, manufacturer_address
       FROM nfts WHERE id = $1 LIMIT 1`,
      [nftId]
    );

    if (!nftResult.rows.length) {
      return NextResponse.json({ error: 'NFT không tìm thấy' }, { status: 404 });
    }

    const nft = nftResult.rows[0];
    if (nft.manufacturer_address !== user.address.toLowerCase()) {
      return NextResponse.json({ error: 'Bạn không sở hữu NFT này' }, { status: 403 });
    }

    const now = new Date().toISOString();

    // Cập nhật database — NFT đã được chuyển trên blockchain bởi wallet của manufacturer
    const updateResult = await pool.query(
      `UPDATE nfts
       SET distributor_address = $1,
           status = 'at_distributor',
           transaction_digest = $2,
           updated_at = $3
       WHERE id = $4
       RETURNING *`,
      [distributorAddress.toLowerCase(), transactionDigest, now, nftId]
    );

    // Cập nhật transfer request thành approved
    try {
      await pool.query(
        `UPDATE transfer_requests_v2
         SET status = 'approved', updated_at = $1
         WHERE nft_id = $2 AND distributor_address = $3 AND status = 'pending'
         LIMIT 1`,
        [now, nftId, distributorAddress.toLowerCase()]
      );
    } catch {}

    try {
      await pool.query(
        `UPDATE transfer_requests
         SET status = 'approved', updated_at = $1
         WHERE nft_id = $2 AND distributor_address = $3 AND status = 'pending'
         LIMIT 1`,
        [now, nftId, distributorAddress.toLowerCase()]
      );
    } catch {}

    // Ghi milestone
    try {
      await pool.query(
        `INSERT INTO milestones (nft_id, type, description, location, timestamp, actor_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          nftId,
          'giao hàng',
          `Đã giao lô thuốc #${nft.batch_number} cho distributor`,
          null,
          now,
          user.address.toLowerCase(),
        ]
      );
    } catch (msErr) {
      logger.warn('API_MANUFACTURER_TRANSFER', 'Failed to record milestone', msErr);
    }

    logger.info('MANUFACTURER_TRANSFER', 'NFT transferred via wallet signing', {
      nftId,
      manufacturer: user.address,
      distributor: distributorAddress,
      digest: transactionDigest,
    });

    return NextResponse.json({
      success: true,
      message: 'Đã chuyển lô thành công',
      data: {
        nft: updateResult.rows[0],
        transactionDigest,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ', details: error.errors }, { status: 400 });
    }
    logger.error('API_MANUFACTURER_TRANSFER', 'Transfer failed', error);
    return NextResponse.json({ error: error.message || 'Lỗi khi transfer' }, { status: 500 });
  }
}
