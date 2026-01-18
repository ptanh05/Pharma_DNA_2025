import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import cache, { getCacheKey } from '@/lib/cache/simple-cache';
import { withRateLimit, rateLimitConfigs } from '@/lib/middleware/rate-limit-wrapper';
import { trackAPI } from '@/lib/utils/api-helpers';

// FIXED: Force dynamic rendering to prevent SSG/prerender
export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Ví dụ: Bảng nfts (id, name, status, created_at, manufacturer_address)

async function handleGET(req: NextRequest) {
  return trackAPI("manufacturer:get", async () => {
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
      // Lấy milestones theo batch_number
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
  // Bổ sung: nếu có query param batch_number thì trả về 1 NFT
  const url = new URL(req.url, "http://localhost");
  const batch_number = url.searchParams.get("batch_number");
  if (batch_number) {
    const { rows } = await pool.query('SELECT * FROM nfts WHERE batch_number = $1', [batch_number]);
    if (rows.length === 0) return NextResponse.json({});
    return NextResponse.json(rows[0]);
  }
  // Bổ sung: nếu có query param name thì trả về 1 NFT đầu tiên có name gần giống
  const name = url.searchParams.get("name");
  if (name) {
    const { rows } = await pool.query('SELECT * FROM nfts WHERE name ILIKE $1 LIMIT 1', [`%${name}%`]);
    if (rows.length === 0) return NextResponse.json({});
    return NextResponse.json(rows[0]);
  }

  // Pagination, search, and filter support
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "10", 10);
  const search = url.searchParams.get("search") || "";
  const statusFilter = url.searchParams.get("status") || "";
  const sortBy = url.searchParams.get("sortBy") || "created_at";
  const sortOrder = url.searchParams.get("sortOrder") || "desc";

  const offset = (page - 1) * limit;

  // Build query
  let query = "SELECT * FROM nfts WHERE 1=1";
  const params: any[] = [];
  let paramCount = 0;

  // Search filter
  if (search) {
    paramCount++;
    query += ` AND (name ILIKE $${paramCount} OR batch_number ILIKE $${paramCount})`;
    params.push(`%${search}%`);
  }

  // Status filter
  if (statusFilter) {
    paramCount++;
    query += ` AND status = $${paramCount}`;
    params.push(statusFilter);
  }

  // Sorting
  const validSortColumns = ["created_at", "name", "batch_number", "status"];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : "created_at";
  const order = sortOrder.toLowerCase() === "asc" ? "ASC" : "DESC";
  query += ` ORDER BY ${sortColumn} ${order}`;

  // Pagination
  paramCount++;
  query += ` LIMIT $${paramCount}`;
  params.push(limit);
  paramCount++;
  query += ` OFFSET $${paramCount}`;
  params.push(offset);

  // Get total count
  let countQuery = "SELECT COUNT(*) as total FROM nfts WHERE 1=1";
  const countParams: any[] = [];
  let countParamCount = 0;

  if (search) {
    countParamCount++;
    countQuery += ` AND (name ILIKE $${countParamCount} OR batch_number ILIKE $${countParamCount})`;
    countParams.push(`%${search}%`);
  }

  if (statusFilter) {
    countParamCount++;
    countQuery += ` AND status = $${countParamCount}`;
    countParams.push(statusFilter);
  }

  const [rowsResult, countResult] = await Promise.all([
    pool.query(query, params),
    pool.query(countQuery, countParams),
  ]);

  const rows = rowsResult.rows;
  const total = parseInt(countResult.rows[0].total, 10);

  const response = {
    items: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };

  // FIXED: Generate cacheKey from query params
  const cacheKey = getCacheKey('manufacturer:nfts', page, limit, search || '', statusFilter || '', sortBy, sortOrder);
  
  // Cache result (5 minutes for read operations)
  cache.set(cacheKey, response, 5 * 60 * 1000);

  return NextResponse.json(response);
  });
}

// Apply rate limiting
export const GET = withRateLimit(handleGET, rateLimitConfigs.read);

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