/**
 * Admin Auth Middleware
 * Protect admin routes
 */

import { NextRequest } from "next/server";
import { adminAuthService } from "@/lib/auth/admin-auth";
import { validationErrorResponse } from "@/lib/utils/api-helpers";
import { logger }from "@/lib/utils/logger";

/**
 * Verify admin token (async — must be awaited).
 */
export async function verifyAdminToken(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");

  if (!authHeader) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "");

  if (!token || !(await adminAuthService.verifyToken(token))) {
    return null;
  }

  return token;
}

/**
 * Check admin auth (async — must be awaited).
 */
export async function checkAdminAuth(req: NextRequest): Promise<boolean> {
  const token = await verifyAdminToken(req);
  return token !== null;
}
