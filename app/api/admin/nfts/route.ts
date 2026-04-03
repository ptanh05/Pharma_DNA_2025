/**
 * GET /api/admin/nfts
 * Admin endpoint to list all NFTs
 */

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { ensureTableExists, TABLE_DEFINITIONS } from "@/lib/db/table-init";

export async function GET(req: NextRequest) {
  try {
    // Ensure table exists before querying
    await ensureTableExists("nfts", TABLE_DEFINITIONS.nfts);

    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = (page - 1) * limit;

    // Build query based on whether address filter is provided
    const countQuery = address
      ? "SELECT COUNT(*) as total FROM nfts WHERE manufacturer_address = $1 OR distributor_address = $2 OR pharmacy_address = $3"
      : "SELECT COUNT(*) as total FROM nfts";

    const dataQuery = address
      ? `SELECT * FROM nfts WHERE manufacturer_address = $1 OR distributor_address = $2 OR pharmacy_address = $3 ORDER BY created_at DESC LIMIT $4 OFFSET $5`
      : `SELECT * FROM nfts ORDER BY created_at DESC LIMIT $1 OFFSET $2`;

    // Execute queries in parallel
    const [countResult, result] = await Promise.all([
      pool.query(countQuery, address ? [address, address, address] : []),
      pool.query(dataQuery, address ? [address, address, address, limit, offset] : [limit, offset]),
    ]);

    const total = parseInt(countResult.rows[0]?.total || "0", 10);

    return NextResponse.json({
      success: true,
      nfts: result.rows || [],
      total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("[/api/admin/nfts]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
