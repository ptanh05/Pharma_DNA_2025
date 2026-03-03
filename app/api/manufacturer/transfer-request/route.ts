import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { z } from 'zod';

// FIXED: Force dynamic rendering to prevent SSG/prerender
export const dynamic = 'force-dynamic';

const transferRequestSchema = z.object({
  nftId: z.number().int().positive("nftId phải là số nguyên dương"),
  distributorAddress: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Địa chỉ Sui không hợp lệ"),
});

const updateRequestSchema = z.object({
  requestId: z.number().int().positive(),
  nftId: z.number().int().positive(),
  distributorAddress: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Địa chỉ Sui không hợp lệ"),
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
  try {
    const body = await req.json();
    const validatedData = transferRequestSchema.parse(body);

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
      return NextResponse.json({ error: "Không thể tạo bảng transfer_requests" }, { status: 500 });
    }

    // Lưu yêu cầu vào bảng
    const result = await pool.query(
      `INSERT INTO transfer_requests (nft_id, distributor_address, status) VALUES ($1, $2, 'pending') RETURNING *`,
      [validatedData.nftId, validatedData.distributorAddress.toLowerCase()]
    );

    return NextResponse.json({ success: true, request: result.rows[0] });
  } catch (error: any) {
    console.error('[TransferRequestAPI] POST Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Lỗi khi tạo yêu cầu' },
      { status: 500 }
    );
  }
}

// PUT /api/manufacturer/transfer-request
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedData = updateRequestSchema.parse(body);

    // 1. Cập nhật trạng thái request sang 'approved'
    await pool.query('UPDATE transfer_requests SET status = $1 WHERE id = $2', ['approved', validatedData.requestId]);

    // 2. Cập nhật distributor_address và status cho NFT
    await pool.query('UPDATE nfts SET distributor_address = $1, status = $2 WHERE id = $3', [validatedData.distributorAddress.toLowerCase(), 'in_transit', validatedData.nftId]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[TransferRequestAPI] PUT Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Lỗi khi cập nhật yêu cầu' },
      { status: 500 }
    );
  }
}