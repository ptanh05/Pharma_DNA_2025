/**
 * Role Authorization Middleware
 * Protect routes based on user role
 */

import { NextRequest }from "next/server";
import { roleAuthService, Role } from "@/lib/auth/role-auth";
import { validationErrorResponse } from "@/lib/utils/api-helpers";
import { logger } from "@/lib/utils/logger";

/**
 * Get user address from request
 */
export function getUserAddress(req: NextRequest): string | null {
  const header = req.headers.get("x-user-address");
  return header ? header.toLowerCase() : null;
}

/**
 * Check user role
 */
export async function checkUserRole(
  req: NextRequest,
  requiredRole: Role
): Promise<boolean> {
  try {
    const address = getUserAddress(req);

    if (!address) {
      return false;
    }

    const userRole = await roleAuthService.getUserRole(address);

    if (!userRole) {
      return false;
    }

    return userRole === requiredRole || userRole === Role.ADMIN;
  } catch (error) {
    logger.error("role-middleware", "Failed to check role", error);
    return false;
  }
}

/**
 * Check permission
 */
export async function checkPermission(
  req: NextRequest,
  permission: string
): Promise<boolean> {
  try {
    const address = getUserAddress(req);

    if (!address) {
      return false;
    }

    return await roleAuthService.hasPermission(address, permission);
  } catch (error) {
    logger.error("role-middleware", "Failed to check permission", error);
    return false;
  }
}

