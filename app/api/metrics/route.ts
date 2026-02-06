/**
 * Metrics API
 * app/api/metrics/route.ts
 */

import { NextRequest } from "next/server";
import { healthService } from "@/lib/services/health.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";

/**
 * GET /api/metrics
 * Get system metrics
 */
export async function GET(req: NextRequest) {
  try {
    const metrics = await healthService.getMetrics();
    return createSuccessResponse(metrics);
  } catch (error: any) {
    return createErrorResponse(error, "METRICS_GET");
  }
}
