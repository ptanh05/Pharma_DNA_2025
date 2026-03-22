/**
 * Admin API - Role Statistics
 * app/api/admin/stats/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { adminRoleService } from "@/lib/services/admin-role.service";
import { createSuccessResponse, createErrorResponse }from "@/lib/utils/api-response";
import { adminAuthService } from "@/lib/auth/admin-auth";

/**
 * GET /api/admin/stats
 * Get role statistics
 */
export async function GET(req: NextRequest) {
  // Authenticate request
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token || !adminAuthService.verifyToken(token)) {
    return NextResponse.json({ error: "Yêu cầu quyền admin" }, { status: 401 });
  }
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
