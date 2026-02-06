/**
 * Admin API - Assign Role
 * app/api/admin/assign-role/route.ts
 */

import { NextRequest } from "next/server";
import { adminRoleService } from "@/lib/services/admin-role.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateRequestBody } from "@/lib/utils/api-validator";
import { z } from "zod";

const assignRoleSchema = z.object({
  address: z.string().min(1, "Address is required"),
  role: z.enum(["MANUFACTURER", "DISTRIBUTOR", "PHARMACY", "ADMIN"]),
});

/**
 * POST /api/admin/assign-role
 * Assign role to user
 */
export async function POST(req: NextRequest) {
  try {
    const { address, role } = await validateRequestBody(req, assignRoleSchema);

    const user = await adminRoleService.assignRole(address, role);

    return createSuccessResponse({
      user,
      message: `Role ${role}assigned successfully`,
    }, 201);
  }catch (error: any) {
    return createErrorResponse(error, "ADMIN_ASSIGN_ROLE");
  }
}
