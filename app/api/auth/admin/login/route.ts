/**
 * Admin Login API Route
 * /api/auth/admin/login
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuthService } from "@/lib/auth/admin-auth";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/utils/api-helpers";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;

    if (!password) {
      return validationErrorResponse("Password is required");
    }

    const token = adminAuthService.login(password);

    return successResponse(
      {
        token,
        expiresIn: 24 * 60 * 60, // 24 hours in seconds
      },
      200
    );
  } catch (error: any) {
    logger.error("admin-login", "Login failed", error);
    return errorResponse(error, error.statusCode || 500);
  }
}

