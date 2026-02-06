/**
 * Admin API - Get User by Address
 * app/api/admin/user/route.ts
 */

import { NextRequest } from "next/server";
import { adminRoleService } from "@/lib/services/admin-role.service";
import { createSuccessResponse, createErrorResponse }from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z } from "zod";

const userQuerySchema = z.object({
  address: z.string().min(1, "Address is required"),
});

/**
 * GET /api/admin/user
 * Get user by address
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams }= new URL(req.url);
    const { address } = validateQueryParams(searchParams, userQuerySchema);

    const user = await adminRoleService.getUserByAddress(address);

    if (!user) {
      return createErrorResponse(
        new Error("User not found"),
        "ADMIN_USER_NOT_FOUND"
      );
    }

    return createSuccessResponse(user);
  } catch (error: any) {
    return createErrorResponse(error, "ADMIN_GET_USER");
  }
}
