/**
 * Dashboard Statistics Service
 * lib/services/dashboard.service.ts
 */

import { pool } from "@/lib/db";
import { logger } from "@/lib/utils/logger";

export class DashboardService {
  /**
   * Get system overview statistics
   */
  async getSystemStats() {
    try {
      const totalNFTs = await pool.query("SELECT COUNT(*) as count FROM nfts");
      const totalUsers = await pool.query("SELECT COUNT(*) as count FROM users");

      return {
        totalNFTs: parseInt(totalNFTs.rows[0].count),
        totalUsers: parseInt(totalUsers.rows[0].count),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("dashboard", "Failed to get stats", error);
      throw error;
    }
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(limit: number = 10) {
    try {
      const result = await pool.query(
        `SELECT * FROM milestones ORDER BY timestamp DESC LIMIT $1`,
        [limit]
      );

      return result.rows;
    }catch (error) {
      logger.error("dashboard", "Failed to get activity", error);
      throw error;
    }
  }
}

export const dashboardService = new DashboardService();
