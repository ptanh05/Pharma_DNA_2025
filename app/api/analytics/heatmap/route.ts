/**
 * API Route: GET /api/analytics/heatmap
 * Returns milestone-based activity heatmap (replaces nfts.created_at approach)
 *
 * Query params:
 * - days: number (default 30)
 */

import { NextRequest } from "next/server";
import { analyticsService } from "@/lib/services/analytics.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z } from "zod";

const heatmapQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { days } = validateQueryParams(searchParams, heatmapQuerySchema);

    const { heatmap, maxCount } = await analyticsService.getActivityHeatmap(days);
    return createSuccessResponse({
      heatmap,
      maxCount,
      days,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return createErrorResponse(error, "ANALYTICS_HEATMAP");
  }
}
