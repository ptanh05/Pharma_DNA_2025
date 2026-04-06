/**
 * Admin Login API Route
 * POST /api/auth/admin/login
 *
 * Body: { username: string; password: string }
 *
 * On success: sets admin_access_token + admin_refresh_token httpOnly cookies.
 * Rate limited: 5 attempts per IP per 15 minutes.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuthService, REFRESH_TOKEN_COOKIE, checkRateLimit } from "@/lib/auth/admin-auth";
import { successResponse, errorResponse, validationErrorResponse } from "@/lib/utils/api-helpers";
import { logError } from "@/lib/logger";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Rate limiting — based on IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many login attempts. Please try again later.",
          resetIn: Math.ceil(rateLimit.resetIn / 1000),
        },
      },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const validatedData = loginSchema.parse(body);

    const { accessCookie, refreshCookie, user } = await adminAuthService.login(
      validatedData.username,
      validatedData.password
    );

    const response = successResponse({ user }, 200);
    response.headers.set("Set-Cookie", accessCookie);
    response.headers.append("Set-Cookie", refreshCookie);
    return response;
  } catch (error: any) {
    logError("Login failed", error);

    if (error instanceof z.ZodError) {
      return validationErrorResponse("Validation failed");
    }

    const statusCode = error?.statusCode ?? 500;

    const response = errorResponse(error, statusCode);
    // Include rate-limit headers so the client knows their remaining attempts
    response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
    response.headers.set("X-RateLimit-Reset-In", String(Math.ceil(rateLimit.resetIn / 1000)));

    // On auth failure, return a generic message to avoid user enumeration
    if (statusCode === 401) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid username or password.",
          },
          rateLimit: {
            remaining: rateLimit.remaining,
            resetIn: Math.ceil(rateLimit.resetIn / 1000),
          },
        },
        {
          status: 401,
          headers: {
            "X-RateLimit-Remaining": String(rateLimit.remaining),
            "X-RateLimit-Reset-In": String(Math.ceil(rateLimit.resetIn / 1000)),
          },
        }
      );
    }

    return errorResponse(error, statusCode);
  }
}