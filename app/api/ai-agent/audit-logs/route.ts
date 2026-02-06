import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z } from "zod";

// Query validation schema
const auditLogsQuerySchema = z.object({
  limit: z.string().default("50").transform(Number).refine(n => n > 0 && n <= 100),
  offset: z.string().default("0").transform(Number).refine(n => n >= 0),
  userId: z.string().optional(),
});

/**
 * GET /api/ai-agent/audit-logs
 * Lấy audit logs (chỉ admin)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { limit, offset, userId }= validateQueryParams(searchParams, auditLogsQuerySchema);

    let query = "SELECT * FROM agent_audit_logs WHERE 1=1";
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

    // Get total count
    const countQuery = "SELECT COUNT(*) as total FROM agent_audit_logs" + 
      (userId ? " WHERE user_id = $1" : "");
    const countResult = await pool.query(countQuery, userId ? [userId.toLowerCase()] : []);

    return createSuccessResponse({
      logs: result.rows,
      pagination: {
        limit,
        offset,
        total: parseInt(countResult.rows[0]?.total || "0"),
      },
    });
  } catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_AUDIT_LOGS");
  }
}
