/**
 * Admin Role Assignment Service
 * lib/services/admin-role.service.ts
 */

import { pool }from "@/lib/db";
import { logger } from "@/lib/utils/logger";

export class AdminRoleService {
  async assignRole(address: string, role: string) {
    try {
      const result = await pool.query(
        `INSERT INTO users (address, role, assigned_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (address) DO UPDATE SET role = $2, updated_at = NOW()
         RETURNING *`,
        [address.toLowerCase(), role]
      );
      logger.info("admin-role", `Role ${role} assigned to ${address}`);
      return result.rows[0];
    } catch (error) {
      logger.error("admin-role", "Failed to assign role", error);
      throw error;
    }
  }

  async getAllUsers(page: number = 1, limit: number = 10) {
    try {
      const offset = (page - 1) * limit;
      const result = await pool.query(
        `SELECT address, role, assigned_at, updated_at
         FROM users
         ORDER BY assigned_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      const countResult = await pool.query("SELECT COUNT(*) as total FROM users");
      return {
        users: result.rows,
        total: parseInt(countResult.rows[0].total),
        page,
        limit,
      };
    } catch (error) {
      logger.error("admin-role", "Failed to get users", error);
      throw error;
    }
  }

  async getUserByAddress(address: string) {
    try {
      const result = await pool.query(
        "SELECT * FROM users WHERE address = $1",
        [address.toLowerCase()]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error("admin-role", "Failed to get user", error);
      throw error;
    }
  }

  async removeUserRole(address: string) {
    try {
      await pool.query("DELETE FROM users WHERE address = $1", [address.toLowerCase()]);
      logger.info("admin-role", `User ${address} role removed`);
    }catch (error) {
      logger.error("admin-role", "Failed to remove user role", error);
      throw error;
    }
  }

  async getRoleStats() {
    try {
      const result = await pool.query(
        `SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY count DESC`
      );
      return result.rows;
    } catch (error) {
      logger.error("admin-role", "Failed to get role stats", error);
      throw error;
    }
  }
}

// Lazy initialization - only create instance when actually needed
let adminRoleServiceInstance: AdminRoleService | null = null;

export function getAdminRoleService(): AdminRoleService {
  if (!adminRoleServiceInstance) {
    adminRoleServiceInstance = new AdminRoleService();
  }
  return adminRoleServiceInstance;
}

// Backward compatibility - deprecated, use getAdminRoleService() instead
export const adminRoleService = new AdminRoleService();

