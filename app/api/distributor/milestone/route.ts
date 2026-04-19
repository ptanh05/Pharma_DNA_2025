/**
 * POST /api/distributor/milestone
 * Distributor/Pharmacy gửi mốc vận chuyển — không yêu cầu admin auth.
 * Actor address được truyền từ frontend (đã verify qua wallet).
 *
 * Body: { nft_id, type, description?, location?, timestamp? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { emitMilestoneAdded } from '@/lib/socket/events';
import { z } from 'zod';
import { ensureTableExists, TABLE_DEFINITIONS } from '@/lib/db/table-init';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const milestoneSchema = z.object({
  nft_id: z.number().int().positive(),
  type: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  timestamp: z.string().optional(),
  actor_address: z.string()
    .min(1)
    .regex(/^0x[a-fA-F0-9]{64}$/, 'Địa chỉ Sui không hợp lệ'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedData = milestoneSchema.parse(body);

    const { nft_id, type, description, location, timestamp, actor_address } = validatedData;

    await ensureTableExists('milestones', TABLE_DEFINITIONS.milestones);

    const result = await pool.query(
      `INSERT INTO milestones (nft_id, type, description, location, timestamp, actor_address)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nft_id, type, description || null, location || null, timestamp || new Date().toISOString(), actor_address.toLowerCase()]
    );

    const milestone = result.rows[0];

    // Nếu là milestone "Đã nhập kho", cập nhật trạng thái NFT
    if (type === 'Đã nhập kho') {
      await pool.query(
        `UPDATE nfts SET status = 'at_pharmacy', receipt_confirmed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [nft_id]
      );
    }

    // Emit socket event
    try {
      emitMilestoneAdded({
        milestoneId: milestone.id,
        nftId: nft_id,
        type: milestone.type,
        description: milestone.description || undefined,
        location: milestone.location || undefined,
        actorAddress: milestone.actor_address,
        timestamp: milestone.timestamp,
      });
    } catch (socketError) {
      logger.error('API_DISTRIBUTOR', 'Failed to emit socket event', socketError);
    }

    return NextResponse.json({ success: true, milestone });
  } catch (error: any) {
    logger.error('API_DISTRIBUTOR', 'POST milestone error', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message || 'Lỗi khi tạo milestone' }, { status: 500 });
  }
}
