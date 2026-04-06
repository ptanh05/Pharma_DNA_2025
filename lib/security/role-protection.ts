/**
 * Role Protection Service
 * Prevents destructive operations that would leave the system in an inconsistent state.
 *
 * Guards:
 * - Cannot remove the last ADMIN (system lockout prevention)
 * - Cannot remove the last MANUFACTURER if NFTs exist (orphan data prevention)
 * - Cannot remove all users of a given role if NFTs depend on that role
 */

import { pool } from "@/lib/db";
import { logger } from "@/lib/utils/logger";

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface RoleProtectionResult {
  allowed: boolean;
  reason?: string;
  code?: string;
  currentCount?: number;
}

export interface RoleStats {
  admin: number;
  manufacturer: number;
  distributor: number;
  pharmacy: number;
}

const ROLE_ORDER = ["ADMIN", "MANUFACTURER", "DISTRIBUTOR", "PHARMACY"] as const;

// ─── Service ──────────────────────────────────────────────────────────────────
class RoleProtectionService {
  /**
   * Check if removing a role from an address is safe.
   * Returns { allowed: true } or { allowed: false, reason, code, currentCount }.
   */
  async canRemoveRole(address: string, role: string): Promise<RoleProtectionResult> {
    try {
      // Check how many users currently have this role
      const result = await pool.query(
        `SELECT role, COUNT(*) as count FROM users WHERE role = $1 GROUP BY role`,
        [role]
      );

      const currentCount = parseInt(result.rows[0]?.count ?? "0", 10);

      // ── Rule 1: Never remove the last ADMIN ──────────────────────────────
      if (role === "ADMIN") {
        if (currentCount <= 1) {
          return {
            allowed: false,
            reason: "Không thể xóa ADMIN cuối cùng. Hệ thống cần ít nhất 1 quản trị viên.",
            code: "LAST_ADMIN",
            currentCount,
          };
        }
      }

      // ── Rule 2: Check if this user is the ONLY MANUFACTURER ──────────────
      if (role === "MANUFACTURER") {
        if (currentCount <= 1) {
          // Check if there are NFTs minted by this manufacturer
          const nftCheck = await pool.query(
            `SELECT COUNT(*) as count FROM nfts WHERE manufacturer_address = $1`,
            [address.toLowerCase()]
          );
          const nftCount = parseInt(nftCheck.rows[0]?.count ?? "0", 10);
          if (nftCount > 0) {
            return {
              allowed: false,
              reason: `Không thể xóa nhà sản xuất cuối cùng. Địa chỉ này đang sở hữu ${nftCount} NFT đang hoạt động. Hãy chuyển NFT trước.`,
              code: "LAST_MANUFACTURER_WITH_NFTS",
              currentCount,
            };
          }
        }
      }

      // ── Rule 3: Check if this user is the ONLY DISTRIBUTOR ───────────────
      if (role === "DISTRIBUTOR") {
        if (currentCount <= 1) {
          // Check if there are NFTs in transit / at distributor
          const nftCheck = await pool.query(
            `SELECT COUNT(*) as count FROM nfts
             WHERE distributor_address = $1 AND status IN ('in_transit', 'at_distributor')`,
            [address.toLowerCase()]
          );
          const nftCount = parseInt(nftCheck.rows[0]?.count ?? "0", 10);
          if (nftCount > 0) {
            return {
              allowed: false,
              reason: `Không thể xóa nhà phân phối cuối cùng. Địa chỉ này đang vận chuyển ${nftCount} NFT. Hãy hoàn thành hoặc chuyển NFT trước.`,
              code: "LAST_DISTRIBUTOR_WITH_NFTS",
              currentCount,
            };
          }
        }
      }

      // ── Rule 4: Check if this user is the ONLY PHARMACY ──────────────────
      if (role === "PHARMACY") {
        if (currentCount <= 1) {
          // Check if there are NFTs at pharmacy
          const nftCheck = await pool.query(
            `SELECT COUNT(*) as count FROM nfts
             WHERE pharmacy_address = $1 AND status IN ('at_pharmacy')`,
            [address.toLowerCase()]
          );
          const nftCount = parseInt(nftCheck.rows[0]?.count ?? "0", 10);
          if (nftCount > 0) {
            return {
              allowed: false,
              reason: `Không thể xóa nhà thuốc cuối cùng. Địa chỉ này đang lưu trữ ${nftCount} NFT. Hãy bán hoặc chuyển NFT trước.`,
              code: "LAST_PHARMACY_WITH_NFTS",
              currentCount,
            };
          }
        }
      }

      return { allowed: true, currentCount };
    } catch (error) {
      logger.error("role-protection", "Error checking role removal safety", error);
      // Fail-safe: deny on error to prevent accidental system damage
      return {
        allowed: false,
        reason: "Không thể kiểm tra an toàn. Vui lòng thử lại.",
        code: "CHECK_FAILED",
      };
    }
  }

  /**
   * Get current role statistics.
   */
  async getRoleStats(): Promise<RoleStats> {
    try {
      const result = await pool.query(
        `SELECT role, COUNT(*) as count FROM users GROUP BY role`
      );
      const stats: RoleStats = { admin: 0, manufacturer: 0, distributor: 0, pharmacy: 0 };
      for (const row of result.rows) {
        const role = row.role as string;
        const count = parseInt(row.count ?? "0", 10);
        if (role === "ADMIN") stats.admin = count;
        else if (role === "MANUFACTURER") stats.manufacturer = count;
        else if (role === "DISTRIBUTOR") stats.distributor = count;
        else if (role === "PHARMACY") stats.pharmacy = count;
      }
      return stats;
    } catch (error) {
      logger.error("role-protection", "Failed to get role stats", error);
      return { admin: 0, manufacturer: 0, distributor: 0, pharmacy: 0 };
    }
  }

  /**
   * Get detailed protection info for the admin dashboard.
   */
  async getProtectionInfo(): Promise<{
    canRemoveAdmin: boolean;
    canRemoveManufacturer: boolean;
    canRemoveDistributor: boolean;
    canRemovePharmacy: boolean;
    roleStats: RoleStats;
    warnings: string[];
  }> {
    const stats = await this.getRoleStats();
    const warnings: string[] = [];

    const canRemoveAdmin = stats.admin > 1;
    const canRemoveManufacturer = stats.manufacturer > 1;
    const canRemoveDistributor = stats.distributor > 1;
    const canRemovePharmacy = stats.pharmacy > 1;

    if (stats.admin === 1) warnings.push("⚠️ Chỉ còn 1 ADMIN - không thể xóa!");
    if (stats.manufacturer === 1) warnings.push("⚠️ Chỉ còn 1 Nhà sản xuất - cần ít nhất 1 để mint NFT.");
    if (stats.distributor === 1) warnings.push("⚠️ Chỉ còn 1 Nhà phân phối - cần ít nhất 1 để vận chuyển.");
    if (stats.pharmacy === 1) warnings.push("⚠️ Chỉ còn 1 Nhà thuốc - cần ít nhất 1 để bán thuốc.");

    return {
      canRemoveAdmin,
      canRemoveManufacturer,
      canRemoveDistributor,
      canRemovePharmacy,
      roleStats: stats,
      warnings,
    };
  }
}

export const roleProtectionService = new RoleProtectionService();