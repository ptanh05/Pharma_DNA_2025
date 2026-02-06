/**
 * Export Service
 * lib/services/export.service.ts
 */

import { pool } from "@/lib/db";
import { logger }from "@/lib/utils/logger";

export class ExportService {
  /**
   * Export NFTs to CSV
   */
  async exportNFTs() {
    try {
      const result = await pool.query("SELECT * FROM nfts ORDER BY created_at DESC");
      logger.info("export", `Exported ${result.rows.length}NFTs`);
      return result.rows;
    } catch (error) {
      logger.error("export", "Failed to export NFTs", error);
      throw error;
    }
  }
}

export const exportService = new ExportService();
