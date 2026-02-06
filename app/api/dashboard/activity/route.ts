/**
 * Dashboard API - Recent Activity
 * app/api/dashboard/activity/route.ts
 */

import { NextRequest } from "next/server";
import { dashboardService } from "@/lib/services/dashboard.service";
import { createSuccessResponse, createErrorResponse }from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z }from "zod";

const activityQuerySchema = z.object({
  limit: z.string().default("10").transform(Number),
});

/**
 * GET /api/dashboard/activity
 * Get recent activity
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { limit } = validateQueryParams(searchParams, activityQuerySchema);

    const activity = await dashboardService.getRecentActivity(limit);

    return createSuccessResponse({
      activity,
      count: activity.length,
    });
  }catch (error: any) {
    return createErrorResponse(error, "DASHBOARD_ACTIVITY");
  }
}
