/**
 * GET /api/registrations
 * List role registrations (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { listRegistrationsSchema } from "@/lib/validation/schemas";
import { logInfo } from "@/lib/utils/logger";

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const status = searchParams.get("status") || undefined;

    logInfo("Listing registrations", { requestId, page, limit, status });

    // Build WHERE clause
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (status) {
      conditions.push(`status = $${paramIdx++}`);
      values.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM role_registrations ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get paginated results
    const offset = (page - 1) * limit;
    const queryValues = [...values, limit, offset];

    const result = await pool.query(
      `SELECT id, wallet_address, requested_role, status,
              company_name, license_number, license_ipfs_hash, tax_id,
              distributor_name, distributor_address,
              pharmacy_name, pharmacy_address,
              contact_email, contact_phone, notes,
              reviewed_by, reviewed_at, rejection_reason, blockchain_tx,
              created_at, updated_at
       FROM role_registrations
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      queryValues
    );

    logInfo("Registrations listed", {
      requestId,
      total,
      page,
      limit,
      returned: result.rows.length,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      data: result.rows,
      total,
      page,
      limit,
    });
  } catch (error: any) {
    logInfo("List registrations failed", {
      requestId,
      error: error.message,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json(
      { error: error.message || "Không thể tải danh sách đơn" },
      { status: 500 }
    );
  }
}
