import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { emitMilestoneAdded } from '@/lib/socket/events';
import { z } from 'zod';
import { ensureTableExists, TABLE_DEFINITIONS } from '@/lib/db/table-init';
import { adminAuthService } from '@/lib/auth/admin-auth';
import { logger } from '@/lib/utils/logger';

// FIXED: Force dynamic rendering to prevent SSG/prerender
export const dynamic = 'force-dynamic';

const milestoneSchema = z.object({
  batch_number: z.string().optional(),
  nft_id: z.number().int().positive().optional(),
  type: z.string().min(1, "type là bắt buộc"),
  description: z.string().optional(),
  location: z.string().optional(),
  timestamp: z.string().optional(),
  actor_address: z.string().min(1, "actor_address là bắt buộc").regex(/^0x[a-fA-F0-9]{64}$/, "Địa chỉ Sui không hợp lệ"),
});

// GET /api/manufacturer/milestone?nft_id=... hoặc ?batch_number=...
// Milestones are read-only and public — no auth required
export async function GET(req: NextRequest) {
  // Authenticate request (optional — milestone data is public)
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  // Skip auth for GET — milestones are read-only public data

  const url = new URL(req.url, "http://localhost");
  const batch_number = url.searchParams.get("batch_number");
  const nft_id = url.searchParams.get("nft_id");
  if (!batch_number && !nft_id) return NextResponse.json([], { status: 200 });
  // Lấy lịch sử các mốc vận chuyển của NFT
  await ensureTableExists('milestones', TABLE_DEFINITIONS.milestones);
  let rows = [];
  if (batch_number) {
    const nftRes = await pool.query('SELECT id FROM nfts WHERE batch_number = $1', [batch_number]);
    if (nftRes.rows.length === 0) return NextResponse.json([]);
    const nftId = nftRes.rows[0].id;
    const msRes = await pool.query('SELECT * FROM milestones WHERE nft_id = $1 ORDER BY timestamp ASC', [nftId]);
    rows = msRes.rows;
  } else if (nft_id) {
    const msRes = await pool.query('SELECT * FROM milestones WHERE nft_id = $1 ORDER BY timestamp ASC', [nft_id]);
    rows = msRes.rows;
  }
  return NextResponse.json(rows);
}

// POST /api/manufacturer/milestone
export async function POST(req: NextRequest) {
  // Authenticate request
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token || !(await adminAuthService.verifyAccessToken(token))) {
    return NextResponse.json({ error: "Yêu cầu quyền admin" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validatedData = milestoneSchema.parse(body);

    let resolvedNftId = validatedData.nft_id;
    if (!resolvedNftId && validatedData.batch_number) {
      const nftRes = await pool.query('SELECT id FROM nfts WHERE batch_number = $1', [validatedData.batch_number]);
      if (nftRes.rows.length === 0) {
        return NextResponse.json({ error: "Không tìm thấy NFT với số lô này" }, { status: 400 });
      }
      resolvedNftId = nftRes.rows[0].id;
    }

    if (!resolvedNftId) {
      return NextResponse.json({ error: "Thiếu thông tin NFT" }, { status: 400 });
    }

    const { type, description, location, timestamp, actor_address } = validatedData;

    // Ensure table exists (only runs once)
    await ensureTableExists('milestones', TABLE_DEFINITIONS.milestones);

    // Lưu mốc vận chuyển
    const result = await pool.query(
      `INSERT INTO milestones (nft_id, type, description, location, timestamp, actor_address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [resolvedNftId, type, description || null, location || null, timestamp || new Date().toISOString(), actor_address.toLowerCase()]
    );

    const milestone = result.rows[0];

    // Nếu là milestone "Đã nhập kho", cập nhật trạng thái NFT
    if (type === "Đã nhập kho") {
      await pool.query(
        `UPDATE nfts SET status = 'at_pharmacy', receipt_confirmed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [resolvedNftId]
      );
    }

    // Emit socket event for real-time update
    try {
      emitMilestoneAdded({
        milestoneId: milestone.id,
        nftId: resolvedNftId,
        batchNumber: validatedData.batch_number || undefined,
        type: milestone.type,
        description: milestone.description,
        location: milestone.location,
        actorAddress: milestone.actor_address,
        timestamp: milestone.timestamp,
      });
    } catch (socketError) {
      logger.error('API_MANUFACTURER', 'Failed to emit socket event', socketError);
    }

    return NextResponse.json({ success: true, milestone });
  } catch (error: any) {
    logger.error('API_MANUFACTURER', 'POST milestone error', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Lỗi khi tạo milestone' },
      { status: 500 }
    );
  }
} 