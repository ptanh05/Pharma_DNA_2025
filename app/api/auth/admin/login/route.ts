/**
 * Admin Login API Route
 * /api/auth/admin/login
 *
 * Body:
 * - password: Admin password
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuthService } from "@/lib/auth/admin-auth";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/utils/api-helpers";
import { logger } from "@/lib/utils/logger";
import { z } from "zod";

const loginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate input with Zod
    const validatedData = loginSchema.parse(body);

    const token = adminAuthService.login(validatedData.password);

    return successResponse(
      {
        token,
        expiresIn: 24 * 60 * 60, // 24 hours in seconds
      },
      200
    );
  } catch (error: any) {
    logger.error("admin-login", "Login failed", error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return validationErrorResponse("Validation failed");
    }

    return errorResponse(error, error.statusCode || 500);
  }
}

