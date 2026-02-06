/**
 * Health Check API
 * app/api/health/route.ts
 */

import { NextRequest } from "next/server";
import { healthService } from "@/lib/services/health.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";

/**
 * GET /api/health
 * Check system health
 */
export async function GET(req: NextRequest) {
  try {
    const health = await healthService.checkHealth();
    return createSuccessResponse(health);
  }catch (error: any) {
    return createErrorResponse(error, "HEALTH_CHECK");
  }
}
