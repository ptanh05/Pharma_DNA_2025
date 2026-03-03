/**
 * Admin Logout API Route
 * /api/auth/admin/logout
 *
 * Headers:
 * - Authorization: Bearer <token>
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuthService } from "@/lib/auth/admin-auth";
import { successResponse, errorResponse, validationErrorResponse } from "@/lib/utils/api-helpers";
import { logger } from "@/lib/utils/logger";
import { extractTokenFromHeader } from "@/lib/auth/jwt";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.get("authorization");
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return validationErrorResponse("Authorization token required");
    }

    adminAuthService.logout(token);

    return successResponse({ success: true, message: "Logged out successfully" }, 200);
  } catch (error: any) {
    logger.error("admin-logout", "Logout failed", error);
    return errorResponse(error, error.statusCode || 500);
  }
}
