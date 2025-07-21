import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// GET /api/manufacturer/transfer-request
export async function GET() {
  // Lấy danh sách yêu cầu chuyển giao
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS transfer_requests (
      id SERIAL PRIMARY KEY,
      nft_id INTEGER NOT NULL,
      distributor_address VARCHAR(100) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )`);
  } catch (e) {
    return NextResponse.json([], { status: 200 });
  }
  const { rows } = await pool.query('SELECT * FROM transfer_requests ORDER BY created_at DESC');
  return NextResponse.json(rows);
}

// POST /api/manufacturer/transfer-request
export async function POST(req: NextRequest) {
  const { nftId, distributorAddress } = await req.json();
  if (!nftId || !distributorAddress) {
    return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 });
  }
  // Kiểm tra bảng transfer_requests đã tồn tại chưa
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS transfer_requests (
      id SERIAL PRIMARY KEY,
      nft_id INTEGER NOT NULL,
      distributor_address VARCHAR(100) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )`);
  } catch (e) {
    // Nếu không tạo được bảng, trả lỗi
    return NextResponse.json({ error: "Không thể tạo bảng transfer_requests" }, { status: 500 });
  }
  // Lưu yêu cầu vào bảng
  const result = await pool.query(
    `INSERT INTO transfer_requests (nft_id, distributor_address, status) VALUES ($1, $2, 'pending') RETURNING *`,
    [nftId, distributorAddress]
  );
  return NextResponse.json({ success: true, request: result.rows[0] });
}

// PUT /api/manufacturer/transfer-request
export async function PUT(req: NextRequest) {
  const { requestId, nftId, distributorAddress } = await req.json();
  if (!requestId || !nftId || !distributorAddress) {
    return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 });
  }
  // 1. Cập nhật trạng thái request sang 'approved'
  await pool.query('UPDATE transfer_requests SET status = $1 WHERE id = $2', ['approved', requestId]);
  // 2. Cập nhật distributor_address và status cho NFT
  await pool.query('UPDATE nfts SET distributor_address = $1, status = $2 WHERE id = $3', [distributorAddress, 'in_transit', nftId]);
  return NextResponse.json({ success: true });
} 