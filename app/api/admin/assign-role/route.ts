/**
 * Admin API - Assign Role
 * app/api/admin/assign-role/route.ts
 */

import { NextRequest } from "next/server";
import { RoleService } from "@/lib/services/role.service";
import { UserRepository } from "@/lib/repositories/user.repository";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { VALID_ROLES } from "@/lib/auth/role-auth";
import { validateRequestBody } from "@/lib/utils/api-validator";
import { z } from "zod";

const userRepo = new UserRepository();
const roleService = new RoleService(userRepo);

const assignRoleSchema = z.object({
  address: z.string().min(1, "Address is required"),
  role: z.enum(VALID_ROLES, { errorMap: () => ({ message: "Invalid role" }) }),
});

/**
 * POST /api/admin/assign-role
 * Assign role to user (database + blockchain)
 */
export async function POST(req: NextRequest) {
  try {
    const { address, role } = await validateRequestBody(req, assignRoleSchema);

    const result = await roleService.assignRole({ address, role });

    if (!result.success) {
      return createErrorResponse(new Error(result.error || "Failed to assign role"), "ADMIN_ASSIGN_ROLE");
    }

    return createSuccessResponse({
      message: result.message,
      transactionHash: result.transactionHash,
      explorerUrl: result.explorerUrl,
    }, 201);
  } catch (error: any) {
    console.error("Assign role error:", error);
    return createErrorResponse(error, "ADMIN_ASSIGN_ROLE");
  }
}
