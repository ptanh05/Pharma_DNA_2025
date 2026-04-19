import { NextRequest } from "next/server";
import { analyticsService } from "@/lib/services/analytics.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z } from "zod";

const statsQuerySchema = z.object({
  period: z.enum(["7d", "30d", "90d"]).default("30d"),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { period } = validateQueryParams(searchParams, statsQuerySchema);

    const stats = await analyticsService.getNFTStats();
    return createSuccessResponse({ stats, period });
  } catch (error: any) {
    return createErrorResponse(error, "ANALYTICS_STATS");
  }
}