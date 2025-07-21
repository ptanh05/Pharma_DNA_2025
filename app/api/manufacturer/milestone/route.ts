import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// GET /api/manufacturer/milestone?nft_id=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url, "http://localhost");
  const nft_id = url.searchParams.get("nft_id");
  if (!nft_id) return NextResponse.json([], { status: 200 });
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
  const { rows } = await pool.query('SELECT * FROM milestones WHERE nft_id = $1 ORDER BY timestamp ASC', [nft_id]);
  return NextResponse.json(rows);
}

// POST /api/manufacturer/milestone
export async function POST(req: NextRequest) {
  const { nft_id, type, description, location, timestamp, actor_address } = await req.json();
  if (!nft_id || !type || !actor_address) {
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
    [nft_id, type, description || null, location || null, timestamp || new Date().toISOString(), actor_address]
  );
  return NextResponse.json({ success: true, milestone: result.rows[0] });
} 