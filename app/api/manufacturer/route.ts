import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Ví dụ: Bảng nfts (id, name, status, created_at, manufacturer_address)

export async function GET(req: NextRequest) {
  if (req.url?.endsWith("/transfer-request")) {
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
  if (req.url?.includes("/milestone")) {
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
  const { rows } = await pool.query('SELECT * FROM nfts');
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  // Nếu là yêu cầu chuyển giao NFT
  if (req.url?.endsWith("/transfer-request")) {
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
  if (req.url?.endsWith("/milestone")) {
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
  const { name, status, manufacturer_address } = await req.json();
  if (!name || !status || !manufacturer_address) return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });
  const now = new Date().toISOString();
  const result = await pool.query(
    `INSERT INTO nfts (name, status, created_at, manufacturer_address)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, status, now, manufacturer_address]
  );
  return NextResponse.json(result.rows[0]);
}

export async function PUT(req: NextRequest) {
  if (req.url?.endsWith("/transfer-request")) {
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
  const { id, status } = await req.json();
  if (!id || !status) return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });
  const result = await pool.query(
    `UPDATE nfts SET status = $1 WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return NextResponse.json(result.rows[0]);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });
  await pool.query('DELETE FROM nfts WHERE id = $1', [id]);
  return NextResponse.json({ success: true });
} 