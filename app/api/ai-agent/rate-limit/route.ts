import { NextRequest } from "next/server";
import { getRateLimitStatus } from "@/lib/ai-agent/rate-limiter";
import { createSuccessResponse, createErrorResponse }from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z }from "zod";

// Query validation schema
const rateLimitQuerySchema = z.object({
  userId: z.string().default("anonymous"),
});

/**
 * GET /api/ai-agent/rate-limit?userId=xxx
 * Lấy thông tin rate limit
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { userId } = validateQueryParams(searchParams, rateLimitQuerySchema);

    const status = getRateLimitStatus(userId);

    return createSuccessResponse({
      rateLimit: {
        remaining: status.remaining,
        resetAt: new Date(status.resetAt).toISOString(),
        resetIn: Math.max(0, Math.ceil((status.resetAt - Date.now()) / 1000)),
      },
    });
  } catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_RATE_LIMIT");
  }
}
