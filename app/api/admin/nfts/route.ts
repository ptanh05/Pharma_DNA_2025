/**
 * GET /api/admin/nfts
 * Admin endpoint to list all NFTs
 */

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = (page - 1) * limit;

    let whereClause = "";
    const values: any[] = [];
    let paramIdx = 1;

    if (address) {
      whereClause = `WHERE manufacturer_address = $${paramIdx++} OR distributor_address = $${paramIdx++} OR pharmacy_address = $${paramIdx++}`;
      values.push(address, address, address);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM nfts ${whereClause}`,
      address ? [address, address, address] : []
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const result = await pool.query(
      `SELECT * FROM nfts ${whereClause} ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...values, limit, offset]
    );

    return NextResponse.json({
      success: true,
      nfts: result.rows,
      total,
      page,
      limit,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
