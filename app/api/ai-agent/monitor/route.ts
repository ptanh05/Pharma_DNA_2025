import { NextRequest }from "next/server";
import { pool }from "@/lib/db";
import { executeAgentTask } from "@/lib/ai-agent/core";
import { createSuccessResponse, createErrorResponse }from "@/lib/utils/api-response";
import { validateRequestBody, validateQueryParams } from "@/lib/utils/api-validator";
import { z } from "zod";
import { logger } from '@/lib/utils/logger';

// Query validation schema
const monitorQuerySchema = z.object({
  checkType: z.enum(["stuck_nfts", "expiring_nfts", "expiring_requests"]).optional(),
});

// POST request validation schema
const monitorPostSchema = z.object({
  issueId: z.string().min(1, "Issue ID is required"),
  action: z.string().min(1, "Action is required"),
});

/**
 * GET /api/ai-agent/monitor
 * Monitor hệ thống và phát hiện vấn đề
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { checkType } = validateQueryParams(searchParams, monitorQuerySchema);

    const issues: any[] = [];

    // Check 1: NFTs stuck in transit
    if (!checkType || checkType === "stuck_nfts") {
      const stuckNFTs = await pool.query(
        `SELECT n.*, MAX(m.timestamp) as last_milestone
         FROM nfts n
         LEFT JOIN milestones m ON n.id = m.nft_id
         WHERE n.status = 'in_transit'
         GROUP BY n.id
         HAVING MAX(m.timestamp) < NOW() - INTERVAL '7 days' OR MAX(m.timestamp) IS NULL`
      );

      for (const nft of stuckNFTs.rows) {
        issues.push({
          type: "stuck_nft",
          severity: "warning",
          nftId: nft.id,
          message: `NFT #${nft.id} (${nft.name}) stuck in transit for 7+ days`,
          action: `Check and remind distributor ${nft.distributor_address}`,
        });
      }
    }

    // Check 2: NFTs expiring soon
    if (!checkType || checkType === "expiring_nfts") {
      const expiringNFTs = await pool.query(
        `SELECT * FROM nfts 
         WHERE expiry_date < NOW() + INTERVAL '30 days' 
         AND expiry_date > NOW()
         AND status != 'delivered'`
      );

      for (const nft of expiringNFTs.rows) {
        issues.push({
          type: "expiring_nft",
          severity: "warning",
          nftId: nft.id,
          message: `NFT #${nft.id} (${nft.name}) expires on ${nft.expiry_date}`,
          action: "Send alert to all stakeholders",
        });
      }
    }

    // Check 3: Transfer requests expiring soon
    if (!checkType || checkType === "expiring_requests") {
      const expiringRequests = await pool.query(
        `SELECT * FROM transfer_requests_v2
         WHERE status = 'pending'
         AND expires_at < NOW() + INTERVAL '2 hours'
         AND expires_at > NOW()`
      );

      for (const req of expiringRequests.rows) {
        issues.push({
          type: "expiring_request",
          severity: "info",
          requestId: req.id,
          message: `Transfer request #${req.id}expiring soon`,
          action: "Remind pharmacy to process",
        });
      }
    }

    // Auto-resolve issues if possible
    if (issues.length > 0 && process.env.OPENAI_API_KEY) {
      for (const issue of issues) {
        if (issue.severity === "info" && issue.type === "expiring_request") {
          try {
            await executeAgentTask(
              `Send reminder notification for transfer request ${issue.requestId}`
            );
          }catch (error) {
            logger.error('API_AI_AGENT', 'Auto-resolve error', error);
          }
        }
      }
    }

    return createSuccessResponse({
      issuesFound: issues.length,
      issues,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_MONITOR_GET");
  }
}

/**
 * POST /api/ai-agent/monitor
 * Trigger agent để tự động giải quyết vấn đề
 */
export async function POST(req: NextRequest) {
  try {
    const { issueId, action } = await validateRequestBody(req, monitorPostSchema);

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Get issue details
    const issue = await pool.query("SELECT * FROM issues WHERE id = $1", [issueId]);
    if (issue.rows.length === 0) {
      throw new Error(`Issue #${issueId}not found`);
    }

    const task = `Resolve issue: ${JSON.stringify(issue.rows[0])}. Action: ${action}`;
    const result = await executeAgentTask(task);

    return createSuccessResponse({ result: result.output }, 200);
  } catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_MONITOR_POST");
  }
}
