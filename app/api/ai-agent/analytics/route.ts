import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z } from "zod";

// Query validation schema
const analyticsQuerySchema = z.object({
  period: z.enum(["7d", "30d", "all"]).default("7d"),
});

/**
 * GET /api/ai-agent/analytics
 * Analytics về AI Agent usage
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { period } = validateQueryParams(searchParams, analyticsQuerySchema);

    let dateFilter = "";
    if (period === "7d") {
      dateFilter = "WHERE timestamp >= NOW() - INTERVAL '7 days'";
    }else if (period === "30d") {
      dateFilter = "WHERE timestamp >= NOW() - INTERVAL '30 days'";
    }

    // Total requests
    const totalRequests = await pool.query(
      `SELECT COUNT(*) as count FROM agent_audit_logs ${dateFilter}`
    );

    // Success rate
    const successRate = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE result = 'success') as success,
        COUNT(*) FILTER (WHERE result = 'failure') as failure
       FROM agent_audit_logs ${dateFilter}`
    );

    // Most used tools
    const mostUsedTools = await pool.query(
      `SELECT tool, COUNT(*) as count
       FROM agent_audit_logs
       ${dateFilter}
       GROUP BY tool
       ORDER BY count DESC
       LIMIT 10`
    );

    // Requests per day
    const requestsPerDay = await pool.query(
      `SELECT 
        DATE(timestamp) as date,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE result = 'success') as success,
        COUNT(*) FILTER (WHERE result = 'failure') as failure
       FROM agent_audit_logs
       ${dateFilter}
       GROUP BY DATE(timestamp)
       ORDER BY date DESC
       LIMIT 30`
    );

    // Top users
    const topUsers = await pool.query(
      `SELECT user_id, COUNT(*) as count
       FROM agent_audit_logs
       ${dateFilter}
       WHERE user_id IS NOT NULL
       GROUP BY user_id
       ORDER BY count DESC
       LIMIT 10`
    );

    // Error types
    const errorTypes = await pool.query(
      `SELECT 
        error,
        COUNT(*) as count
       FROM agent_audit_logs
       ${dateFilter}
       WHERE result = 'failure' AND error IS NOT NULL
       GROUP BY error
       ORDER BY count DESC
       LIMIT 10`
    );

    // Average response time
    const avgResponseTime = await pool.query(
      `SELECT 
        AVG(EXTRACT(EPOCH FROM (updated_at - timestamp))) as avg_seconds
       FROM agent_audit_logs
       ${dateFilter}`
    );

    const analytics = {
      period,
      summary: {
        totalRequests: parseInt(totalRequests.rows[0]?.count || "0"),
        successCount: parseInt(successRate.rows[0]?.success || "0"),
        failureCount: parseInt(successRate.rows[0]?.failure || "0"),
        successRate:
          totalRequests.rows[0]?.count > 0
            ? (
                (parseInt(successRate.rows[0]?.success || "0") /
                  parseInt(totalRequests.rows[0]?.count || "1")) *
                100
              ).toFixed(2)
            : "0",
        avgResponseTime: parseFloat(avgResponseTime.rows[0]?.avg_seconds || "0").toFixed(2),
      },
      mostUsedTools: mostUsedTools.rows,
      requestsPerDay: requestsPerDay.rows,
      topUsers: topUsers.rows,
      errorTypes: errorTypes.rows,
      generatedAt: new Date().toISOString(),
    };

    return createSuccessResponse(analytics);
  } catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_ANALYTICS");
  }
}
