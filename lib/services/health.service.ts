/**
 * Health Check Service
 * lib/services/health.service.ts
 */

import { pool } from "@/lib/db";
import { logger }from "@/lib/utils/logger";

export class HealthService {
  /**
   * Check system health
   */
  async checkHealth() {
    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        database: "unknown",
        api: "ok",
      },
    };

    // Check database
    try {
      await pool.query("SELECT 1");
      health.services.database = "ok";
    }catch (error) {
      health.services.database = "error";
      health.status = "degraded";
      logger.error("health", "Database check failed", error);
    }

    return health;
  }

  /**
   * Get system metrics
   */
  async getMetrics() {
    try {
      const nftCount = await pool.query("SELECT COUNT(*) as count FROM nfts");
      const userCount = await pool.query("SELECT COUNT(*) as count FROM users");
      const milestoneCount = await pool.query("SELECT COUNT(*) as count FROM milestones");

      return {
        nfts: parseInt(nftCount.rows[0].count),
        users: parseInt(userCount.rows[0].count),
        milestones: parseInt(milestoneCount.rows[0].count),
        timestamp: new Date().toISOString(),
      };
    }catch (error) {
      logger.error("health", "Failed to get metrics", error);
      throw error;
    }
  }
}

export const healthService = new HealthService();

