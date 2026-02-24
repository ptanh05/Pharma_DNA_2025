import { pool } from "@/lib/db";
import { logger } from "@/lib/utils/logger";

export class AnalyticsService {
  async getNFTStats() {
    try {
      const byStatus = await pool.query(
        "SELECT status, COUNT(*) as count FROM nfts GROUP BY status"
      );
      const byType = await pool.query(
        "SELECT type, COUNT(*) as count FROM nfts GROUP BY type"
      );
      const byRegion = await pool.query(
        "SELECT manufacturer_address, COUNT(*) as count FROM nfts GROUP BY manufacturer_address LIMIT 10"
      );

      return { byStatus: byStatus.rows, byType: byType.rows, byRegion: byRegion.rows };
    } catch (error) {
      logger.error("analytics", "Failed to get NFT stats", error);
      throw error;
    }
  }

  async getTransferTrends(period: string = "7d") {
    try {
      // Convert period format: '7d' -> '7 days', '30d' -> '30 days'
      const periodMap: { [key: string]: string } = {
        '7d': '7 days',
        '30d': '30 days',
        '90d': '90 days',
      };
      const intervalStr = periodMap[period] || '7 days';

      const result = await pool.query(
        `SELECT DATE(created_at) as date, COUNT(*) as count 
         FROM nfts 
         WHERE created_at >= NOW() - INTERVAL '${intervalStr}'
         GROUP BY DATE(created_at) 
         ORDER BY date`
      );
      return result.rows;
    } catch (error) {
      logger.error("analytics", "Failed to get transfer trends", error);
      throw error;
    }
  }

  async getExpiringAlerts() {
    try {
      const result = await pool.query(
        "SELECT id, name, expiry_date FROM nfts WHERE expiry_date < NOW() + INTERVAL '30 days' ORDER BY expiry_date"
      );
      return result.rows;
    } catch (error) {
      logger.error("analytics", "Failed to get expiring alerts", error);
      throw error;
    }
  }
}

export const analyticsService = new AnalyticsService();
