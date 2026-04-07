/**
 * GET /api/distributor/transfer-requests
 * Lấy danh sách transfer requests từ bảng transfer_requests_v2
 * Dùng cho Pharmacy để xem các yêu cầu nhận lô từ distributor
 */

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { ensureTableExists, TABLE_DEFINITIONS } from "@/lib/db/table-init";

export async function GET(req: NextRequest) {
  try {
    // Ensure tables exist
    await Promise.all([
      ensureTableExists("transfer_requests_v2", TABLE_DEFINITIONS.transfer_requests_v2),
      ensureTableExists("transfer_requests", TABLE_DEFINITIONS.transfer_requests),
    ]).catch(() => {});

    const { searchParams } = new URL(req.url);
    const pharmacy_address = searchParams.get("pharmacy_address");
    const distributor_address = searchParams.get("distributor_address");
    const status = searchParams.get("status");

    // Try transfer_requests_v2 first (has transfer_note)
    let query = `SELECT * FROM transfer_requests_v2 WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (pharmacy_address) {
      query += ` AND pharmacy_address = $${idx}`;
      params.push(pharmacy_address.toLowerCase());
      idx++;
    }

    if (distributor_address) {
      query += ` AND distributor_address = $${idx}`;
      params.push(distributor_address.toLowerCase());
      idx++;
    }

    if (status) {
      query += ` AND status = $${idx}`;
      params.push(status);
      idx++;
    }

    query += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);

    // If no results from v2, try original table
    let rows = result.rows;
    if (rows.length === 0) {
      let fallbackQuery = `SELECT * FROM transfer_requests WHERE 1=1`;
      const fallbackParams: any[] = [];
      let fIdx = 1;

      if (pharmacy_address) {
        fallbackQuery += ` AND pharmacy_address = $${fIdx}`;
        fallbackParams.push(pharmacy_address.toLowerCase());
        fIdx++;
      }

      if (status) {
        fallbackQuery += ` AND status = $${fIdx}`;
        fallbackParams.push(status);
        fIdx++;
      }

      fallbackQuery += ` ORDER BY created_at DESC LIMIT 100`;
      const fallbackResult = await pool.query(fallbackQuery, fallbackParams);
      rows = fallbackResult.rows;
    }

    return NextResponse.json(
      {
        success: true,
        data: rows,
        total: rows.length,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[/api/distributor/transfer-requests]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
