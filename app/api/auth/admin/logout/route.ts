/**
 * Admin Logout API Route
 * /api/auth/admin/logout
 */

import { NextRequest } from "next/server";
import { adminAuthService } from "@/lib/auth/admin-auth";
import { successResponse, errorResponse, validationErrorResponse } from "@/lib/utils/api-helpers";
import { logger }from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return validationErrorResponse("Token is required");
    }

    adminAuthService.logout(token);

    return successResponse({ success: true }, 200);
  } catch (error: any) {
    logger.error("admin-logout", "Logout failed", error);
    return errorResponse(error, error.statusCode || 500);
  }
}
