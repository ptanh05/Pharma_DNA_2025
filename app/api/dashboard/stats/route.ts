/**
 * Dashboard API - System Stats
 * app/api/dashboard/stats/route.ts
 */

import { NextRequest } from "next/server";
import { dashboardService } from "@/lib/services/dashboard.service";
import { createSuccessResponse, createErrorResponse }from "@/lib/utils/api-response";

/**
 * GET /api/dashboard/stats
 * Get system statistics
 */
export async function GET(req: NextRequest) {
  try {
    const stats = await dashboardService.getSystemStats();
    return createSuccessResponse(stats);
  }catch (error: any) {
    return createErrorResponse(error, "DASHBOARD_STATS");
  }
}
