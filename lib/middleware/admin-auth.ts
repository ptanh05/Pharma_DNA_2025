/**
 * Admin Auth Middleware Helpers
 * Protect admin routes
 *
 * These helpers delegate to adminAuthService. They are used by API routes
 * under /api/admin/* that need to extract the current user.
 * Note: /api/admin/* routes are already protected by the root middleware.ts.
 */

import { NextRequest } from "next/server";
import { adminAuthService, ACCESS_TOKEN_COOKIE } from "@/lib/auth/admin-auth";

/**
 * Verify admin token from cookie and return the admin user.
 * Used by API routes that need to access the current user object.
 */
export async function getAdminUserFromRequest(req: NextRequest) {
  const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;
  return adminAuthService.getUserFromToken(token);
}

/**
 * Verify admin token (async — must be awaited).
 * Returns the admin user object if valid, null otherwise.
 */
export async function verifyAdminToken(req: NextRequest) {
  const user = await getAdminUserFromRequest(req);
  return user;
}

/**
 * Check admin auth (async — must be awaited).
 */
export async function checkAdminAuth(req: NextRequest) {
  const user = await getAdminUserFromRequest(req);
  return user !== null;
}

/**
 * Require admin role — verifies the admin user has "admin" role.
 * Returns the admin user if authorized, null otherwise.
 *
 * Use this instead of verifyAdminToken for routes that require
 * admin-level privileges (not just any admin user).
 */
export async function requireAdminRole(req: NextRequest) {
  const user = await getAdminUserFromRequest(req);
  if (!user) return null;
  if (user.role !== "admin" && user.role !== "super_admin") {
    return null;
  }
  return user;
}
