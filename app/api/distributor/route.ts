import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// FIXED: Force dynamic rendering to prevent SSG/prerender
export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Ví dụ: Bảng nfts (id, name, status, distributor_address)

export async function GET(req: NextRequest) {
  const url = new URL(req.url, "http://localhost");

  if (req.url?.endsWith("/roles")) {
    // Trả về danh sách các ví có role DISTRIBUTOR từ bảng users
    const { rows } = await pool.query("SELECT address FROM users WHERE role = 'DISTRIBUTOR'");
    return NextResponse.json(rows);
  }

  // Get query params
  const address = url.searchParams.get("address");
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

  // Filter by distributor address if provided
  if (address) {
    paramCount++;
    query += ` AND distributor_address = $${paramCount}`;
    params.push(address.toLowerCase());
  } else {
    // Default: show in_transit NFTs
    paramCount++;
    query += ` AND status = $${paramCount}`;
    params.push("in_transit");
  }

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

  if (address) {
    countParamCount++;
    countQuery += ` AND distributor_address = $${countParamCount}`;
    countParams.push(address.toLowerCase());
  } else {
    countParamCount++;
    countQuery += ` AND status = $${countParamCount}`;
    countParams.push("in_transit");
  }

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

  return NextResponse.json({
    items: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function PUT(req: NextRequest) {
  const { id, status, distributor_address } = await req.json();
  if (!id || !status || !distributor_address) return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });
  const result = await pool.query(
    `UPDATE nfts SET status = $1, distributor_address = $2 WHERE id = $3 RETURNING *`,
    [status, distributor_address, id]
  );
  return NextResponse.json(result.rows[0]);
}

export async function POST(req: NextRequest) {
  // Xử lý upload sensor data
  if (req.url?.endsWith("/upload-sensor")) {
    try {
      const formData = await req.formData();
      const sensorFile = formData.get("sensorData");
      const nftId = formData.get("nftId");
      const distributorAddress = formData.get("distributorAddress");
      if (!sensorFile || !nftId || !distributorAddress) {
        return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 });
      }
      // Upload file lên IPFS (Pinata)
      if (!process.env.PINATA_JWT) {
        return NextResponse.json({ error: "PINATA_JWT chưa được cấu hình" }, { status: 500 });
      }
      const fileForm = new FormData();
      fileForm.append("file", sensorFile);
      const ipfsRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
        body: fileForm,
      });
      if (!ipfsRes.ok) {
        const errText = await ipfsRes.text();
        return NextResponse.json({ error: "Lỗi khi upload file lên IPFS", detail: errText }, { status: 500 });
      }
      const ipfsData = await ipfsRes.json();
      const sensorIpfsHash = ipfsData.IpfsHash;
      // TODO: Cập nhật metadata NFT trên contract nếu cần (yêu cầu quyền distributor hoặc owner)
      // Có thể lưu hash này vào DB nếu muốn
      return NextResponse.json({ success: true, sensorIpfsHash });
    } catch (err: any) {
      return NextResponse.json({ error: "Lỗi khi upload sensor data", detail: err.message }, { status: 500 });
    }
  }
} 