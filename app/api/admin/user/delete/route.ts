/**
 * Admin API - Delete User
 * app/api/admin/user/delete/route.ts
 */

import { NextRequest }from "next/server";
import { adminRoleService } from "@/lib/services/admin-role.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateRequestBody }from "@/lib/utils/api-validator";
import { z } from "zod";

const deleteUserSchema = z.object({
  address: z.string().min(1, "Address is required"),
});

/**
 * DELETE /api/admin/user/delete
 * Delete user role
 */
export async function DELETE(req: NextRequest) {
  try {
    const { address } = validateRequestBody(req, deleteUserSchema);

    await adminRoleService.removeUserRole(address);

    return createSuccessResponse({
      message: "User role removed successfully",
    });
  } catch (error: any) {
    return createErrorResponse(error, "ADMIN_DELETE_USER");
  }
}

