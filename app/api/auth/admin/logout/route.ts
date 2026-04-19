/**
 * Admin Logout API Route
 * GET /api/auth/admin/logout
 *
 * Reads refreshToken from httpOnly cookie, invalidates it,
 * and clears both access + refresh cookies.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  adminAuthService,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearCookie,
} from "@/lib/auth/admin-auth";
import { successResponse } from "@/lib/utils/api-helpers";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (refreshToken) {
    await adminAuthService.logout(refreshToken);
    logger.info("admin-logout", "Admin logout successful");
  }

  const response = successResponse({ message: "Logged out successfully" }, 200);

  // Clear both cookies
  response.headers.set("Set-Cookie", clearCookie(ACCESS_TOKEN_COOKIE));
  response.headers.append("Set-Cookie", clearCookie(REFRESH_TOKEN_COOKIE));

  return response;
}
