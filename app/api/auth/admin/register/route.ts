/**
 * Admin Register API Route
 * POST /api/auth/admin/register
 *
 * Body: { username: string; password: string; email?: string; role?: string; registerKey?: string }
 *
 * First admin registration: requires ADMIN_REGISTER_KEY env var.
 * Subsequent registrations: require a valid admin access token (enforced by middleware).
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthService } from "@/lib/auth/admin-auth";
import { successResponse, validationErrorResponse } from "@/lib/utils/api-helpers";
import { parseError } from "@/lib/utils/error-handler";
import { logger } from "@/lib/logger";
import { z } from "zod";

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(100),
  password: z.string().min(8, "Password must be at least 8 characters"),
  email: z.string().email("Invalid email address").optional(),
  role: z.string().optional(),
  registerKey: z.string().optional(),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedData = registerSchema.parse(body);

    const user = await adminAuthService.register(
      validatedData.username,
      validatedData.password,
      {
        email: validatedData.email,
        role: validatedData.role,
        registerKey: validatedData.registerKey,
      }
    );

    logger.info("admin-register", `Admin registered: ${user.username}`, { userId: user.id });

    return successResponse(
      {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          created_at: user.created_at,
        },
      },
      201
    );
  } catch (error: any) {
    try { logger.error("admin-register", "Registration failed", error); } catch {}

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return validationErrorResponse(error.errors.map((e) => e.message).join(", "));
    }

    // Safe error response — never throw
    const errorCode = error?.code || "INTERNAL_ERROR";
    const errorMessage = typeof error?.message === "string"
      ? error.message.substring(0, 500)
      : "Internal server error";
    const statusCode = typeof error?.statusCode === "number" && error.statusCode >= 100 && error.statusCode < 600
      ? error.statusCode
      : 500;

    return NextResponse.json(
      { success: false, error: { code: errorCode, message: errorMessage } },
      { status: statusCode }
    );
  }
}
