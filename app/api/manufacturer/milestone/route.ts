import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
  const { batch_number, nft_id, type, description, location, timestamp, actor_address } = await req.json();
  let resolvedNftId = nft_id;
  if (!resolvedNftId && batch_number) {
    const nftRes = await pool.query('SELECT id FROM nfts WHERE batch_number = $1', [batch_number]);
    if (nftRes.rows.length === 0) {
      return NextResponse.json({ error: "Không tìm thấy NFT với số lô này" }, { status: 400 });
    }
    resolvedNftId = nftRes.rows[0].id;
  }
  if (!resolvedNftId || !type || !actor_address) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }
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
    [resolvedNftId, type, description || null, location || null, timestamp || new Date().toISOString(), actor_address]
  );
  return NextResponse.json({ success: true, milestone: result.rows[0] });
} 