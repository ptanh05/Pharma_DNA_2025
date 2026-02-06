/**
 * Admin API - Role Statistics
 * app/api/admin/stats/route.ts
 */

import { NextRequest } from "next/server";
import { adminRoleService } from "@/lib/services/admin-role.service";
import { createSuccessResponse, createErrorResponse }from "@/lib/utils/api-response";

/**
 * GET /api/admin/stats
 * Get role statistics
 */
export async function GET(req: NextRequest) {
  try {
    const stats = await adminRoleService.getRoleStats();

    return createSuccessResponse({
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return createErrorResponse(error, "ADMIN_GET_STATS");
  }
}
