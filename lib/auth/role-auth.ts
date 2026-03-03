/**
 * Role-Based Authorization Service
 * Handle role checking and permissions
 */

import { pool }from "@/lib/db";
import { AppError, ErrorTypes } from "@/lib/utils/error-handler";
import { logger } from "@/lib/utils/logger";

export enum Role {
  MANUFACTURER = "MANUFACTURER",
  DISTRIBUTOR = "DISTRIBUTOR",
  PHARMACY = "PHARMACY",
  ADMIN = "ADMIN",
}

// Shared constant for role validation
export const VALID_ROLES = [Role.MANUFACTURER, Role.DISTRIBUTOR, Role.PHARMACY, Role.ADMIN] as const;
export type ValidRole = typeof VALID_ROLES[number];

export const RolePermissions: Record<Role, string[]> = {
  [Role.MANUFACTURER]: [
    "create_nft",
    "upload_ipfs",
    "mint_nft",
    "view_own_nfts",
  ],
  [Role.DISTRIBUTOR]: [
    "receive_nft",
    "update_status",
    "add_milestone",
    "transfer_to_pharmacy",
  ],
  [Role.PHARMACY]: [
    "receive_nft",
    "verify_nft",
    "confirm_receipt",
    "view_inventory",
  ],
  [Role.ADMIN]: [
    "assign_role",
    "view_all_nfts",
    "view_all_users",
    "manage_system",
  ],
};

class RoleAuthService {
  /**
   * Get user role
   */
  async getUserRole(address: string): Promise<Role | null> {
    try {
      const result = await pool.query(
        "SELECT role FROM users WHERE address = $1",
        [address.toLowerCase()]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].role as Role;
    } catch (error) {
      logger.error("role-auth", "Failed to get user role", error);
      throw error;
    }
  }

  /**
   * Check if user has permission
   */
  async hasPermission(
    address: string,
    permission: string
  ): Promise<boolean> {
    try {
      const role = await this.getUserRole(address);

      if (!role) {
        return false;
      }

      const permissions = RolePermissions[role];
      return permissions.includes(permission);
    } catch (error) {
      logger.error("role-auth", "Failed to check permission", error);
      return false;
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(address: string, role: Role): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO users (address, role, assigned_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (address) DO UPDATE SET role = $2`,
        [address.toLowerCase(), role]
      );

      logger.info("role-auth", `Role ${role}assigned to ${address}`);
    }catch (error) {
      logger.error("role-auth", "Failed to assign role", error);
      throw error;
    }
  }

  /**
   * Check if user is admin
   */
  async isAdmin(address: string): Promise<boolean> {
    const role = await this.getUserRole(address);
    return role === Role.ADMIN;
  }
}

export const roleAuthService = new RoleAuthService();

