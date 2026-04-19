/**
 * Admin API - Assign Role
 * app/api/admin/assign-role/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { RoleService } from "@/lib/services/role.service";
import { UserRepository } from "@/lib/repositories/user.repository";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { VALID_ROLES } from "@/lib/auth/role-auth";
import { validateRequestBody } from "@/lib/utils/api-validator";
import { verifyAdminToken } from "@/lib/middleware/admin-auth";
import {
  checkSensitiveActionRateLimit,
  SENSITIVE_ACTIONS,
} from "@/lib/security/admin-rate-limit";
import { adminAuditLog, AUDIT_ACTIONS } from "@/lib/security/admin-audit-log";
import { validateAndNormalizeAddress } from "@/lib/security/address-validation";
import { z } from "zod";
import { logger } from '@/lib/utils/logger';

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
  // ── Admin auth verification ───────────────────────────────────────────────
  const adminUser = await verifyAdminToken(req);
  if (!adminUser) {
    return NextResponse.json(
      { success: false, error: "Bạn phải đăng nhập để tiếp tục" },
      { status: 401 }
    );
  }

  const adminId = String(adminUser.id);
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip") ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  // ── Rate limit check ───────────────────────────────────────────────────
  const rateLimitResponse = checkSensitiveActionRateLimit(adminId, SENSITIVE_ACTIONS.ASSIGN_ROLE);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { address, role } = await validateRequestBody(req, assignRoleSchema);

    // ── Address validation with checksum verification ──────────────────────
    const addressValidation = validateAndNormalizeAddress(address, { requireChecksum: false });
    if (!addressValidation.valid) {
      return createErrorResponse(
        new Error(addressValidation.error || "Địa chỉ không hợp lệ"),
        "ADMIN_ASSIGN_ROLE"
      );
    }
    const normalizedAddress = addressValidation.address;

    const result = await roleService.assignRole({ address: normalizedAddress, role });

    if (!result.success) {
      await adminAuditLog.log({
        adminId,
        adminUsername: adminUser.username,
        action: AUDIT_ACTIONS.ASSIGN_ROLE,
        targetAddress: normalizedAddress,
        targetRole: role,
        ipAddress: clientIP,
        userAgent,
        requestBody: { address: normalizedAddress, role },
        responseStatus: 400,
        resultMessage: `Thất bại: ${result.error}`,
      }).catch(() => {});
      return createErrorResponse(new Error(result.error || "Failed to assign role"), "ADMIN_ASSIGN_ROLE");
    }

    // Audit log (non-blocking)
    await adminAuditLog.log({
      adminId,
      adminUsername: adminUser.username,
      action: AUDIT_ACTIONS.ASSIGN_ROLE,
      targetAddress: normalizedAddress,
      targetRole: role,
      ipAddress: clientIP,
      userAgent,
      requestBody: { address: normalizedAddress, role },
      responseStatus: 201,
      resultMessage: result.message,
      blockchainTx: result.transactionHash ?? null,
      metadata: { checksummed: addressValidation.checksummed },
    }).catch(() => {});

    return createSuccessResponse({
      message: result.message,
      transactionHash: result.transactionHash,
      explorerUrl: result.explorerUrl,
    }, 201);
  } catch (error: any) {
    logger.error('API_ADMIN', 'POST assign-role error', error);
    await adminAuditLog.log({
      adminId,
      adminUsername: adminUser.username,
      action: AUDIT_ACTIONS.ASSIGN_ROLE,
      ipAddress: clientIP,
      userAgent,
      responseStatus: 500,
      resultMessage: `Lỗi: ${error.message}`,
    }).catch(() => {});
    return createErrorResponse(error, "ADMIN_ASSIGN_ROLE");
  }
}
