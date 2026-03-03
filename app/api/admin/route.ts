import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { adminRoleService } from "@/lib/services/admin-role.service";
import { suiService }from "@/lib/blockchain/sui.service";
import { getContractObjectId } from "@/lib/blockchain/provider-sui";
import { createSuccessResponse, createErrorResponse }from "@/lib/utils/api-response";
import { VALID_ROLES } from "@/lib/auth/role-auth";
import { z } from "zod";

/**
 * Get dashboard stats - extracted for reuse
 */
async function getDashboardStats() {
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
  try {
    const clonedReq = req.clone();
    const bodyText = await clonedReq.text();
    if (!bodyText?.trim()) {
      return createSuccessResponse({ message: "No action", timestamp: new Date().toISOString() });
    }

    const rawBody = JSON.parse(bodyText);

    // --- Assign role flow ---
    if (rawBody.address && rawBody.role) {
      const parsed = assignRoleSchema.safeParse(rawBody);
      if (!parsed.success) {
        return createErrorResponse(new Error(parsed.error.message), "ADMIN_ASSIGN_ROLE");
      }
      const { address, role } = parsed.data;

      // 1. Lưu vào DB trước
      const user = await adminRoleService.assignRole(address, role);

      // 2. Sync lên onchain
      let blockchainTx: string | null = null;
      let blockchainError: string | null = null;
      let blockchainSynced = false;

      if (suiService.isReady()) {
        try {
          const contractId = getContractObjectId();
          blockchainTx = await suiService.grantRole(address, role, contractId);
          blockchainSynced = true;
          // Cập nhật trạng thái sync vào DB
          await pool.query(
            `UPDATE users SET blockchain_synced = true, blockchain_tx = $1, blockchain_error = NULL, last_sync_attempt = NOW()
             WHERE address = $2`,
            [blockchainTx, address.toLowerCase()]
          );
        }catch (err: any) {
          blockchainError = err.message;
          await pool.query(
            `UPDATE users SET blockchain_synced = false, blockchain_error = $1, last_sync_attempt = NOW()
             WHERE address = $2`,
            [blockchainError, address.toLowerCase()]
          );
        }
      }

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
      });
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
    return createErrorResponse(error, "ADMIN_ACTION");
  }
}

/**
 * DELETE /api/admin - Remove user role
 */
export async function DELETE(req: NextRequest) {
  try {
    const { address } = await req.json();
    if (!address) return createErrorResponse(new Error("Address required"), "ADMIN_DELETE");
    await adminRoleService.removeUserRole(address);
    return createSuccessResponse({ message: `Đã xóa quyền của ${address}` });
  }catch (error: any) {
    return createErrorResponse(error, "ADMIN_DELETE");
  }
}
