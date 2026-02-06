/**
 * Admin API - Get Users
 * app/api/admin/users/route.ts
 */

import { NextRequest } from "next/server";
import { adminRoleService } from "@/lib/services/admin-role.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z } from "zod";

const usersQuerySchema = z.object({
  page: z.string().default("1").transform(Number),
  limit: z.string().default("10").transform(Number),
});

/**
 * GET /api/admin/users
 * Get all users with roles
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { page, limit } = validateQueryParams(searchParams, usersQuerySchema);

    const result = await adminRoleService.getAllUsers(page, limit);

    return createSuccessResponse(result);
  } catch (error: any) {
    return createErrorResponse(error, "ADMIN_GET_USERS");
  }
}

