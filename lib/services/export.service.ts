/**
 * Export Service
 * lib/services/export.service.ts
 */

import { pool } from "@/lib/db";
import { logger } from "@/lib/utils/logger";

export class ExportService {
  /**
   * Export NFTs to JSON array
   */
  async exportNFTs() {
    try {
      const result = await pool.query("SELECT * FROM nfts ORDER BY created_at DESC");
      logger.info("export", `Exported ${result.rows.length} NFTs`);
      return result.rows;
    } catch (error) {
      logger.error("export", "Failed to export NFTs", error);
      throw error;
    }
  }

  /**
   * Export users to JSON array
   */
  async exportUsers() {
    try {
      const result = await pool.query("SELECT * FROM users ORDER BY created_at DESC");
      logger.info("export", `Exported ${result.rows.length} users`);
      return result.rows;
    } catch (error) {
      logger.error("export", "Failed to export users", error);
      throw error;
    }
  }

  /**
   * Export full admin report: NFTs + users + stats
   */
  async exportAdminReport() {
    try {
      const [nftsResult, usersResult] = await Promise.all([
        pool.query("SELECT * FROM nfts ORDER BY created_at DESC"),
        pool.query("SELECT * FROM users ORDER BY created_at DESC"),
      ]);

      const statsQuery = `
        SELECT
          (SELECT COUNT(*) FROM nfts) as total_nfts,
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM users WHERE role = 'MANUFACTURER') as manufacturers,
          (SELECT COUNT(*) FROM users WHERE role = 'DISTRIBUTOR') as distributors,
          (SELECT COUNT(*) FROM users WHERE role = 'PHARMACY') as pharmacies,
          (SELECT COUNT(*) FROM users WHERE role = 'ADMIN') as admins
      `;
      const statsResult = await pool.query(statsQuery);

      const report = {
        generatedAt: new Date().toISOString(),
        stats: statsResult.rows[0] || {},
        nfts: nftsResult.rows,
        users: usersResult.rows,
      };

      logger.info("export", `Exported admin report: ${nftsResult.rows.length} NFTs, ${usersResult.rows.length} users`);
      return report;
    } catch (error) {
      logger.error("export", "Failed to export admin report", error);
      throw error;
    }
  }

  /**
   * Convert array of objects to CSV string
   */
  toCSV(data: Record<string, any>[]): string {
    if (!data || data.length === 0) return "";
    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
      headers
        .map((h) => {
          const val = String(row[h] ?? "");
          // Escape values containing comma, quote, or newline
          if (val.includes(",") || val.includes('"') || val.includes("\n")) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        })
        .join(",")
    );
    return [headers.join(","), ...rows].join("\n");
  }
}

export const exportService = new ExportService();
