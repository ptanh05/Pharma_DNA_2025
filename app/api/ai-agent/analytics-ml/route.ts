import { NextRequest }from "next/server";
import {
  predictDemand,
  predictQualityScore,
  predictFraudProbability,
  analyzeTrends,
  getComprehensiveAnalytics,
}from "@/lib/ai-agent/analytics-ml";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z } from "zod";

// Query validation schema
const analyticsMLQuerySchema = z.object({
  type: z.enum(["demand", "quality", "fraud", "trends", "comprehensive"]).optional(),
  period: z.enum(["7d", "30d", "90d", "all"]).default("30d"),
  nftId: z.string().optional().transform(v => v ? parseInt(v) : undefined),
});

/**
 * GET /api/ai-agent/analytics-ml
 * Get ML-powered analytics
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { type, period, nftId } = validateQueryParams(searchParams, analyticsMLQuerySchema);

    switch (type) {
      case "demand":
        const demand = await predictDemand(period as any);
        return createSuccessResponse({ prediction: demand });

      case "quality":
        if (!nftId) {
          throw new Error("nftId parameter is required for quality prediction");
        }
        const quality = await predictQualityScore(nftId);
        return createSuccessResponse({ prediction: quality });

      case "fraud":
        if (!nftId) {
          throw new Error("nftId parameter is required for fraud prediction");
        }
        const fraud = await predictFraudProbability(nftId);
        return createSuccessResponse({ prediction: fraud });

      case "trends":
        const trends = await analyzeTrends(period as any);
        return createSuccessResponse({ prediction: trends });

      case "comprehensive":
      default:
        const comprehensive = await getComprehensiveAnalytics(period as any);
        return createSuccessResponse({ prediction: comprehensive });
    }
  }catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_ANALYTICS_ML");
  }
}
