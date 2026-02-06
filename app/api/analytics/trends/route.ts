import { NextRequest } from "next/server";
import { analyticsService } from "@/lib/services/analytics.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z } from "zod";

const trendsQuerySchema = z.object({
  period: z.enum(["7d", "30d", "90d"]).default("7d"),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { period } = validateQueryParams(searchParams, trendsQuerySchema);

    const trends = await analyticsService.getTransferTrends(period);
    return createSuccessResponse({ period, trends });
  } catch (error: any) {
    return createErrorResponse(error, "ANALYTICS_TRENDS");
  }
}