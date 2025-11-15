import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

/**
 * GET /api/ai-agent/audit-logs
 * Lấy audit logs (chỉ admin)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const userId = searchParams.get("userId");

    let query = `
      SELECT * FROM agent_audit_logs
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (userId) {
      paramCount++;
      query += ` AND user_id = $${paramCount}`;
      params.push(userId.toLowerCase());
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      logs: result.rows,
      total: result.rows.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Lỗi khi lấy audit logs",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

