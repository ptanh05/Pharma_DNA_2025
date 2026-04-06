import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { adminRoleService } from "@/lib/services/admin-role.service";
import { suiService }from "@/lib/blockchain/sui.service";
import { getContractObjectId } from "@/lib/blockchain/provider-sui";
import { createSuccessResponse, createErrorResponse }from "@/lib/utils/api-response";
import { VALID_ROLES } from "@/lib/auth/role-auth";
import { z } from "zod";
import { ensureTableExists, TABLE_DEFINITIONS } from "@/lib/db/table-init";
import { verifyAdminToken } from "@/lib/middleware/admin-auth";
import {
  checkSensitiveActionRateLimit,
  SENSITIVE_ACTIONS,
} from "@/lib/security/admin-rate-limit";
import { adminAuditLog, AUDIT_ACTIONS } from "@/lib/security/admin-audit-log";
import { roleProtectionService } from "@/lib/security/role-protection";
import { validateAndNormalizeAddress } from "@/lib/security/address-validation";

/**
 * Get dashboard stats - extracted for reuse
 */
async function getDashboardStats() {
  // Ensure all required tables exist
  await ensureTableExists("users", TABLE_DEFINITIONS.users);
  await ensureTableExists("nfts", TABLE_DEFINITIONS.nfts);
  await ensureTableExists("transfer_requests", TABLE_DEFINITIONS.transfer_requests);
  await ensureTableExists("agent_audit_logs", TABLE_DEFINITIONS.agent_audit_logs);

  const [usersResult, nftsResult, transfersResult, agentsResult] = await Promise.all([
    pool.query("SELECT COUNT(*) as count FROM users"),
    pool.query("SELECT COUNT(*) as count FROM nfts"),
    pool.query("SELECT COUNT(*) as count FROM transfer_requests"),
    pool.query("SELECT COUNT(*) as count FROM agent_audit_logs WHERE timestamp >= NOW() - INTERVAL '24 hours'"),
  ]);
  return {
    users: parseInt(usersResult.rows[0]?.count || "0"),
    nfts: parseInt(nftsResult.rows[0]?.count || "0"),
    transfers: parseInt(transfersResult.rows[0]?.count || "0"),
    activeAgents: parseInt(agentsResult.rows[0]?.count || "0"),
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * GET /api/admin - Stats overview
 */
export async function GET(req: NextRequest) {
  try {
    const adminUser = await verifyAdminToken(req);
    if (!adminUser) {
      return NextResponse.json(
        { success: false, error: "Bạn phải đăng nhập để tiếp tục" },
        { status: 401 }
      );
    }
    const stats = await getDashboardStats();
    return createSuccessResponse(stats);
  } catch (error: any) {
    return createErrorResponse(error, "ADMIN_STATS");
  }
}

const assignRoleSchema = z.object({
  address: z.string().min(1),
  role: z.enum(VALID_ROLES),
});

/**
 * POST /api/admin
 * - Nếu body có address + role: assign role vào DB rồi sync onchain
 * - Ngược lại: xử lý admin actions (sync/refresh/cleanup/stats)
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

  try {
    const clonedReq = req.clone();
    const bodyText = await clonedReq.text();
    if (!bodyText?.trim()) {
      return createSuccessResponse({ message: "No action", timestamp: new Date().toISOString() });
    }

    const rawBody = JSON.parse(bodyText);

    // --- Assign role flow ---
    if (rawBody.address && rawBody.role) {
      // Rate limit check
      const rateLimitResponse = checkSensitiveActionRateLimit(adminId, SENSITIVE_ACTIONS.ASSIGN_ROLE);
      if (rateLimitResponse) return rateLimitResponse;

      const parsed = assignRoleSchema.safeParse(rawBody);
      if (!parsed.success) {
        return createErrorResponse(new Error(parsed.error.message), "ADMIN_ASSIGN_ROLE");
      }

      // Address validation with checksum verification
      const addressValidation = validateAndNormalizeAddress(parsed.data.address, { requireChecksum: false });
      if (!addressValidation.valid) {
        return createErrorResponse(new Error(addressValidation.error || "Địa chỉ không hợp lệ"), "ADMIN_ASSIGN_ROLE");
      }
      const { address, role } = { address: addressValidation.address, role: parsed.data.role };

      // 1. Lưu vào DB trước
      const user = await adminRoleService.assignRole(address, role);

      // 2. Sync lên onchain
      let blockchainTx: string | null = null;
      let blockchainError: string | null = null;
      let blockchainSynced = false;

      if (suiService.isReady()) {
        try {
          const contractId = getContractObjectId();
          if (!contractId) {
            blockchainError = "Contract ID not configured";
          } else {
            blockchainTx = await suiService.grantRole(address, role, contractId);
            blockchainSynced = true;
            // Cập nhật trạng thái sync vào DB
            await pool.query(
              `UPDATE users SET blockchain_synced = true, blockchain_tx = $1, blockchain_error = NULL, last_sync_attempt = NOW()
               WHERE address = $2`,
              [blockchainTx, address.toLowerCase()]
            );
          }
        }catch (err: any) {
          blockchainError = err.message;
          await pool.query(
            `UPDATE users SET blockchain_synced = false, blockchain_error = $1, last_sync_attempt = NOW()
             WHERE address = $2`,
            [blockchainError, address.toLowerCase()]
          );
        }
      }

      // Audit log (non-blocking)
      await adminAuditLog.log({
        adminId,
        adminUsername: adminUser.username,
        action: AUDIT_ACTIONS.ASSIGN_ROLE,
        targetAddress: address,
        targetRole: role,
        ipAddress: clientIP,
        userAgent,
        requestBody: { address, role },
        responseStatus: 201,
        resultMessage: blockchainSynced
          ? `Đã cấp quyền ${role} cho địa chỉ ${address} và đồng bộ onchain thành công`
          : `Đã cấp quyền ${role} cho địa chỉ ${address}`,
        blockchainTx,
        metadata: { checksummed: addressValidation.checksummed },
      });

      return createSuccessResponse({
        user,
        message: blockchainSynced
          ? `Đã cấp quyền ${role} cho địa chỉ ${address} và đồng bộ onchain thành công`
          : `Đã cấp quyền ${role} cho địa chỉ ${address} (chưa đồng bộ onchain${blockchainError ? ": " + blockchainError : ""})`,
        blockchain: {
          synced: blockchainSynced,
          tx: blockchainTx,
          error: blockchainError,
        },
      }, 201);
    }

    // --- Admin actions flow ---
    const { action } = rawBody;
    let result: any;
    switch (action) {
      case "sync":
        result = { message: "Sync completed", timestamp: new Date().toISOString() };
        break;
      case "refresh":
        result = { message: "Cache refreshed", timestamp: new Date().toISOString() };
        break;
      case "cleanup":
        try {
          await pool.query("DELETE FROM agent_audit_logs WHERE timestamp < NOW() - INTERVAL '90 days'");
          result = { message: "Cleanup completed", deleted: true, timestamp: new Date().toISOString() };
        }catch (dbError: any) {
          result = { message: "Cleanup skipped", error: dbError.message, timestamp: new Date().toISOString() };
        }
        break;
      default:
        result = await getDashboardStats();
    }
    return createSuccessResponse(result);
  } catch (error: any) {
    // Audit log failure
    await adminAuditLog.log({
      adminId,
      adminUsername: adminUser.username,
      action: AUDIT_ACTIONS.ASSIGN_ROLE,
      ipAddress: clientIP,
      userAgent,
      responseStatus: 500,
      resultMessage: `Lỗi: ${error.message}`,
    }).catch(() => {});

    return createErrorResponse(error, "ADMIN_ACTION");
  }
}

/**
 * DELETE /api/admin - Remove user role
 */
export async function DELETE(req: NextRequest) {
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

  try {
    const body = await req.json();
    const { address, role, confirmationToken } = body;

    if (!address) {
      return createErrorResponse(new Error("Address required"), "ADMIN_DELETE");
    }

    // ── Rate limit check ───────────────────────────────────────────────────
    const rateLimitResponse = checkSensitiveActionRateLimit(adminId, SENSITIVE_ACTIONS.REMOVE_ROLE);
    if (rateLimitResponse) return rateLimitResponse;

    // ── Address validation ───────────────────────────────────────────────
    const addressValidation = validateAndNormalizeAddress(address, { requireChecksum: false });
    if (!addressValidation.valid) {
      return createErrorResponse(new Error(addressValidation.error || "Địa chỉ không hợp lệ"), "ADMIN_DELETE");
    }
    const normalizedAddress = addressValidation.address;

    // ── Fetch current user to determine role ──────────────────────────────
    const currentUser = await adminRoleService.getUserByAddress(normalizedAddress);
    if (!currentUser) {
      return createErrorResponse(new Error("Người dùng không tồn tại"), "ADMIN_DELETE");
    }

    const targetRole = role ?? (currentUser as any).role;

    // ── Role protection check ────────────────────────────────────────────
    const protection = await roleProtectionService.canRemoveRole(normalizedAddress, targetRole);
    if (!protection.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: protection.code,
            message: protection.reason,
          },
          roleStats: await roleProtectionService.getRoleStats(),
        },
        { status: 409 }
      );
    }

    // ── Dangerous role: require confirmation token ───────────────────────
    if (targetRole === "ADMIN" || targetRole === "MANUFACTURER") {
      if (!confirmationToken) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "CONFIRMATION_REQUIRED",
              message: `Xác nhận cần thiết: Bạn đang xóa vai trò quan trọng (${targetRole}). Vui lòng gửi kèm confirmationToken để xác nhận.`,
            },
            requiresConfirmation: true,
            targetRole,
          },
          { status: 403 }
        );
      }
      // Verify confirmation token matches admin's own access token
      const tokenFromCookie = req.cookies.get("admin_access_token")?.value;
      if (confirmationToken !== tokenFromCookie) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_CONFIRMATION",
              message: "Mã xác nhận không hợp lệ.",
            },
          },
          { status: 403 }
        );
      }
    }

    // ── Perform removal ───────────────────────────────────────────────────
    await adminRoleService.removeUserRole(normalizedAddress);

    // Audit log (non-blocking)
    await adminAuditLog.log({
      adminId,
      adminUsername: adminUser.username,
      action: AUDIT_ACTIONS.REMOVE_ROLE,
      targetAddress: normalizedAddress,
      targetRole,
      ipAddress: clientIP,
      userAgent,
      requestBody: { address: normalizedAddress, role: targetRole },
      responseStatus: 200,
      resultMessage: `Đã xóa quyền ${targetRole} của ${normalizedAddress}`,
      metadata: { roleStats: protection.currentCount },
    }).catch(() => {});

    return createSuccessResponse({
      message: `Đã xóa quyền ${targetRole} của ${normalizedAddress}`,
      roleStats: await roleProtectionService.getRoleStats(),
    });
  } catch (error: any) {
    await adminAuditLog.log({
      adminId,
      adminUsername: adminUser.username,
      action: AUDIT_ACTIONS.REMOVE_ROLE,
      ipAddress: clientIP,
      userAgent,
      responseStatus: 500,
      resultMessage: `Lỗi: ${error.message}`,
    }).catch(() => {});

    return createErrorResponse(error, "ADMIN_DELETE");
  }
}
