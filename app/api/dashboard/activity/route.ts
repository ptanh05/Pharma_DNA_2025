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
  address: z.string().optional(),
  nft_id: z.string().transform(v => v ? parseInt(v) : undefined).optional(),
});

/**
 * GET /api/dashboard/activity
 * Get recent activity
 *
 * Query params:
 * - limit: number (default 10)
 * - address: filter by actor address (manufacturer/distributor/pharmacy)
 * - nft_id: filter by specific NFT
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { limit, address, nft_id } = validateQueryParams(searchParams, activityQuerySchema);

    const activity = await dashboardService.getRecentActivity(limit, address, nft_id);

    return createSuccessResponse({
      activity,
      count: activity.length,
    });
  }catch (error: any) {
    return createErrorResponse(error, "DASHBOARD_ACTIVITY");
  }
}
