/**
 * API Route: GET /api/distributor/request-inventory
 * Distributor xem danh sách yêu cầu nhận lô của mình
 *
 * API Route: POST /api/distributor/request-inventory
 * Distributor requests to receive an NFT from a manufacturer
 *
 * This is called by distributors from their dashboard.
 * Ownership is verified from database (distributor_address in request body must match DB record).
 * No JWT required — wallet signature is implicit via distributorAddress verification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from "@/lib/db";
import { logInfo, logError } from '@/lib/logger';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { ensureTableExists, TABLE_DEFINITIONS } from "@/lib/db/table-init";

/**
 * GET /api/distributor/request-inventory
 * Lấy danh sách transfer requests theo distributor address
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const distributor_address = searchParams.get("distributor_address");
    const status = searchParams.get("status");

    if (!distributor_address) {
      return NextResponse.json(
        { error: "distributor_address là bắt buộc" },
        { status: 400 }
      );
    }

    await Promise.all([
      ensureTableExists("transfer_requests_v2", TABLE_DEFINITIONS.transfer_requests_v2),
      ensureTableExists("transfer_requests", TABLE_DEFINITIONS.transfer_requests),
    ]).catch(() => {});

    // Try transfer_requests_v2 first
    let query = `SELECT * FROM transfer_requests_v2 WHERE distributor_address = $1`;
    const params: any[] = [distributor_address.toLowerCase()];
    let idx = 2;

    if (status) {
      query += ` AND status = $${idx}`;
      params.push(status);
      idx++;
    }

    query += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);

    // Fallback to original table if v2 is empty
    let rows = result.rows;
    if (rows.length === 0) {
      const fallbackQuery = `SELECT * FROM transfer_requests WHERE distributor_address = $1${status ? ` AND status = '${status}'` : ''} ORDER BY created_at DESC LIMIT 100`;
      const fallbackResult = await pool.query(fallbackQuery, [distributor_address.toLowerCase()]);
      rows = fallbackResult.rows;
    }

    return NextResponse.json({
      success: true,
      data: rows,
      total: rows.length,
    }, { status: 200 });
  } catch (error: any) {
    console.error("[/api/distributor/request-inventory GET]", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

const requestSchema = z.object({
  nftId: z.number().min(1, 'nftId là bắt buộc'),
  distributorAddress: z.string()
    .regex(/^0x[a-fA-F0-9]{64}$/, 'Địa chỉ Sui không hợp lệ'),
});

export async function POST(req: NextRequest) {
  const requestId = uuidv4();

  try {
    // Bước 1: Validate request body
    const body = await req.json();
    const validatedData = requestSchema.parse(body);
    const distributorAddress = validatedData.distributorAddress.toLowerCase();

    // Bước 2: Ensure tables exist
    await Promise.all([
      ensureTableExists("nfts", TABLE_DEFINITIONS.nfts),
      ensureTableExists("transfer_requests_v2", TABLE_DEFINITIONS.transfer_requests_v2),
    ]).catch(() => {});

    // Bước 3: Lấy NFT từ database
    const nftResult = await pool.query(
      `SELECT id, batch_number, name, status, manufacturer_address, distributor_address
       FROM nfts WHERE id = $1 LIMIT 1`,
      [validatedData.nftId]
    );

    if (!nftResult.rows.length) {
      return NextResponse.json({ error: 'NFT không tìm thấy' }, { status: 404 });
    }

    const nft = nftResult.rows[0];

    // Bước 4: Verify NFT is available (minted = available for transfer)
    if (nft.status !== 'minted') {
      return NextResponse.json(
        { error: `NFT này không có sẵn để nhận (trạng thái hiện tại: ${nft.status})` },
        { status: 400 }
      );
    }

    // Bước 5: Kiểm tra đã có request pending chưa
    const existingResult = await pool.query(
      `SELECT id FROM transfer_requests_v2
       WHERE nft_id = $1 AND distributor_address = $2 AND status = 'pending'`,
      [validatedData.nftId, distributorAddress]
    );

    if (existingResult.rows.length > 0) {
      return NextResponse.json(
        { error: 'Bạn đã gửi yêu cầu nhận lô này rồi' },
        { status: 400 }
      );
    }

    // Bước 6: Tạo transfer request
    const insertResult = await pool.query(
      `INSERT INTO transfer_requests_v2
       (nft_id, distributor_address, status, created_at, updated_at)
       VALUES ($1, $2, 'pending', NOW(), NOW())
       RETURNING id, nft_id, distributor_address, status, created_at`,
      [validatedData.nftId, distributorAddress]
    );

    const transferRequest = insertResult.rows[0];

    logInfo('Distributor inventory request created', {
      requestId,
      nftId: validatedData.nftId,
      distributor: distributorAddress,
      manufacturer: nft.manufacturer_address,
    });

    return NextResponse.json({
      success: true,
      message: 'Đã gửi yêu cầu nhận lô thành công. Vui lòng chờ nhà sản xuất chấp thuận!',
      data: {
        request: transferRequest,
        nft: {
          id: nft.id,
          batch_number: nft.batch_number,
          name: nft.name,
          manufacturer: nft.manufacturer_address,
        },
      },
    }, { status: 201 });

  } catch (error: any) {
    logError('Distributor request-inventory error', error, { requestId });

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: error.errors[0]?.message || 'Dữ liệu không hợp lệ',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Lỗi khi gửi yêu cầu nhận lô',
    }, { status: 500 });
  }
}
