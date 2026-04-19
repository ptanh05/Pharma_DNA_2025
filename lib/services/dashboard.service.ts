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
      const [totalNFTs, totalUsers] = await Promise.all([
        pool.query("SELECT COUNT(*) as count FROM nfts"),
        pool.query("SELECT COUNT(*) as count FROM users"),
      ]);

      return {
        totalNFTs: parseInt(totalNFTs.rows[0]?.count || "0"),
        totalUsers: parseInt(totalUsers.rows[0]?.count || "0"),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("dashboard", "Failed to get stats", error);
      throw error;
    }
  }

  /**
   * Get recent activity
   * @param limit Max number of records
   * @param address Optional: filter by actor address (manufacturer/distributor/pharmacy)
   * @param nftId Optional: filter by specific NFT
   */
  async getRecentActivity(limit: number = 10, address?: string, nftId?: number) {
    try {
      const params: (string | number)[] = [];
      let idx = 1;
      let where = "";

      if (address) {
        where += ` WHERE actor_address = $${idx}`;
        params.push(address.toLowerCase());
        idx++;
      }

      if (nftId) {
        where += where ? ` AND nft_id = $${idx}` : ` WHERE nft_id = $${idx}`;
        params.push(nftId);
      }

      params.push(limit);

      const result = await pool.query(
        `SELECT * FROM milestones${where} ORDER BY timestamp DESC LIMIT $${idx}`,
        params
      );

      return result.rows;
    }catch (error) {
      logger.error("dashboard", "Failed to get activity", error);
      throw error;
    }
  }
}

export const dashboardService = new DashboardService();
