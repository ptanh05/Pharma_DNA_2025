/**
 * Admin Auth Middleware
 * Protect admin routes
 */

import { NextRequest } from "next/server";
import { adminAuthService } from "@/lib/auth/admin-auth";
import { validationErrorResponse } from "@/lib/utils/api-helpers";
import { logger }from "@/lib/utils/logger";

/**
 * Verify admin token
 */
export function verifyAdminToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");

  if (!authHeader) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "");

  if (!adminAuthService.verifyToken(token)) {
    return null;
  }

  return token;
}

/**
 * Check admin auth
 */
export function checkAdminAuth(req: NextRequest): boolean {
  const token = verifyAdminToken(req);
  return token !== null;
}
