import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { emitMilestoneAdded } from '@/lib/socket/events';
import { z } from 'zod';

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

// GET /api/manufacturer/milestone?nft_id=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url, "http://localhost");
  const batch_number = url.searchParams.get("batch_number");
  const nft_id = url.searchParams.get("nft_id");
  if (!batch_number && !nft_id) return NextResponse.json([], { status: 200 });
  // Lấy lịch sử các mốc vận chuyển của NFT
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS milestones (
      id SERIAL PRIMARY KEY,
      nft_id INTEGER NOT NULL,
      type VARCHAR(50) NOT NULL,
      description TEXT,
      location VARCHAR(255),
      timestamp TIMESTAMP NOT NULL,
      actor_address VARCHAR(100) NOT NULL
    )`);
  } catch (e) {
    return NextResponse.json([], { status: 200 });
  }
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

    // Tạo bảng milestones nếu chưa có
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS milestones (
        id SERIAL PRIMARY KEY,
        nft_id INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        description TEXT,
        location VARCHAR(255),
        timestamp TIMESTAMP NOT NULL,
        actor_address VARCHAR(100) NOT NULL
      )`);
    } catch (e) {
      return NextResponse.json({ error: "Không thể tạo bảng milestones" }, { status: 500 });
    }

    // Lưu mốc vận chuyển
    const result = await pool.query(
      `INSERT INTO milestones (nft_id, type, description, location, timestamp, actor_address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [resolvedNftId, type, description || null, location || null, timestamp || new Date().toISOString(), actor_address.toLowerCase()]
    );

    const milestone = result.rows[0];

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
      console.error("Failed to emit socket event:", socketError);
    }

    return NextResponse.json({ success: true, milestone });
  } catch (error: any) {
    console.error('[MilestoneAPI] Error:', error);

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