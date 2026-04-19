/**
 * GET /api/registrations
 * List role registrations (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { logger } from "@/lib/utils/logger";
import { ensureTableExists, TABLE_DEFINITIONS } from "@/lib/db/table-init";

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Ensure table exists before querying
    await ensureTableExists("role_registrations", TABLE_DEFINITIONS.role_registrations).catch((e) => {
      logger.error('API_REGISTRATIONS', 'ensureTableExists error', e);
    });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const status = searchParams.get("status") || undefined;

    logger.info("REGISTRATIONS_LIST", "Listing registrations", { requestId, page, limit, status });

    // Build WHERE clause
    const conditions: string[] = [];
    const countValues: any[] = [];
    const dataValues: any[] = [];
    let countParamIdx = 1;

    if (status) {
      conditions.push(`status = $${countParamIdx++}`);
      countValues.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM role_registrations ${whereClause}`,
      countValues
    );
    const total = parseInt(countResult.rows[0]?.total || "0", 10);

    // Get paginated results - use separate param index for data query
    const offset = (page - 1) * limit;
    const dataParamIdx = countValues.length + 1;

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
       LIMIT $${dataParamIdx} OFFSET $${dataParamIdx + 1}`,
      [...countValues, limit, offset]
    );

    logger.info("REGISTRATIONS_LIST", "Registrations listed", {
      requestId,
      total,
      page,
      limit,
      returned: result.rows.length,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      data: result.rows || [],
      total,
      page,
      limit,
    });
  } catch (error: unknown) {
    logger.error("REGISTRATIONS_LIST", "List registrations failed", { requestId, error: (error as any)?.message, durationMs: Date.now() - startTime });

    return NextResponse.json(
      { error: (error as any)?.message || "Không thể tải danh sách đơn" },
      { status: 500 }
    );
  }
}
