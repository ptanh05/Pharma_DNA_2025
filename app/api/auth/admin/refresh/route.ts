/**
 * Admin Token Refresh API Route
 * POST /api/auth/admin/refresh
 *
 * Reads refreshToken from httpOnly cookie "admin_refresh_token".
 * Verifies, checks for invalidation, rotates token.
 * Returns new access + refresh cookies.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuthService, REFRESH_TOKEN_COOKIE } from "@/lib/auth/admin-auth";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Refresh token required" } },
      { status: 401 }
    );
  }

  try {
    const { accessCookie, refreshCookie } = await adminAuthService.refresh(refreshToken);

    const response = NextResponse.json(
      { success: true, data: { message: "Tokens refreshed" } },
      { status: 200 }
    );
    response.headers.set("Set-Cookie", accessCookie);
    response.headers.append("Set-Cookie", refreshCookie);
    return response;
  } catch (error: any) {
    logger.warn("admin-refresh", "Token refresh failed", { error: error.message });
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or expired refresh token" } },
      { status: 401 }
    );
  }
}
