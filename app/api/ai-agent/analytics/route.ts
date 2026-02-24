import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { createSuccessResponse, createErrorResponse }from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z } from "zod";

const analyticsQuerySchema = z.object({
  period: z.enum(["7d", "30d", "all"]).default("7d"),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { period } = validateQueryParams(searchParams, analyticsQuerySchema);

    let whereClause = "";
    let andClause = "";
    if (period === "7d") {
      whereClause = "WHERE timestamp >= NOW() - INTERVAL '7 days'";
      andClause = "AND timestamp >= NOW() - INTERVAL '7 days'";
    } else if (period === "30d") {
      whereClause = "WHERE timestamp >= NOW() - INTERVAL '30 days'";
      andClause = "AND timestamp >= NOW() - INTERVAL '30 days'";
    }

    const [totalRequests, successRate, mostUsedTools, requestsPerDay, topUsers, errorTypes, avgResponseTime] =
      await Promise.all([
        pool.query(`SELECT COUNT(*) as count FROM agent_audit_logs ${whereClause}`),
        pool.query(`SELECT COUNT(*) FILTER (WHERE result = 'success') as success, COUNT(*) FILTER (WHERE result = 'failure') as failure FROM agent_audit_logs ${whereClause}`),
        pool.query(`SELECT tool, COUNT(*) as count FROM agent_audit_logs ${whereClause}GROUP BY tool ORDER BY count DESC LIMIT 10`),
        pool.query(`SELECT DATE(timestamp) as date, COUNT(*) as count, COUNT(*) FILTER (WHERE result = 'success') as success, COUNT(*) FILTER (WHERE result = 'failure') as failure FROM agent_audit_logs ${whereClause} GROUP BY DATE(timestamp) ORDER BY date DESC LIMIT 30`),
        pool.query(`SELECT user_id, COUNT(*) as count FROM agent_audit_logs WHERE user_id IS NOT NULL ${andClause} GROUP BY user_id ORDER BY count DESC LIMIT 10`),
        pool.query(`SELECT error, COUNT(*) as count FROM agent_audit_logs WHERE result = 'failure' AND error IS NOT NULL ${andClause}GROUP BY error ORDER BY count DESC LIMIT 10`),
        pool.query(`SELECT AVG(EXTRACT(EPOCH FROM (updated_at - timestamp))) as avg_seconds FROM agent_audit_logs ${whereClause}`),
      ]);

    const analytics = {
      period,
      summary: {
        totalRequests: parseInt(totalRequests.rows[0]?.count || "0"),
        successCount: parseInt(successRate.rows[0]?.success || "0"),
        failureCount: parseInt(successRate.rows[0]?.failure || "0"),
        successRate:
          totalRequests.rows[0]?.count > 0
            ? ((parseInt(successRate.rows[0]?.success || "0") / parseInt(totalRequests.rows[0]?.count || "1")) * 100).toFixed(2)
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
