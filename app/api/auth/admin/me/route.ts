/**
 * Admin /me API Route
 * GET /api/auth/admin/me
 *
 * Returns the currently authenticated admin user based on the
 * access token cookie. This endpoint is protected by the root middleware.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuthService, ACCESS_TOKEN_COOKIE } from "@/lib/auth/admin-auth";
import { successResponse } from "@/lib/utils/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  try {
    const user = await adminAuthService.getUserFromToken(accessToken);

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "User not found" } },
        { status: 401 }
      );
    }

    return successResponse(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        last_login: user.last_login,
      },
      200
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Invalid token" } },
      { status: 401 }
    );
  }
}
