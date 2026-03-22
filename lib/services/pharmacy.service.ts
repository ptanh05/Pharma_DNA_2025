/**
 * Pharmacy Service
 * lib/services/pharmacy.service.ts
 */

import { pool } from "@/lib/db";
import { logger } from "@/lib/utils/logger";

export class PharmacyService {
  /**
   * Get pharmacy inventory
   */
  async getPharmacyInventory(address: string, page: number = 1, limit: number = 10) {
    try {
      const offset = (page - 1) * limit;

      const result = await pool.query(
        `SELECT * FROM nfts WHERE LOWER(pharmacy_address) = LOWER($1) AND status IN ('at_pharmacy', 'minted')
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [address, limit, offset]
      );

      const countResult = await pool.query(
        "SELECT COUNT(*) as total FROM nfts WHERE LOWER(pharmacy_address) = LOWER($1) AND status IN ('at_pharmacy', 'minted')",
        [address]
      );

      return {
        inventory: result.rows,
        total: parseInt(countResult.rows[0].total),
        page,
        limit,
      };
    }catch (error) {
      logger.error("pharmacy", "Failed to get inventory", error);
      throw error;
    }
  }

  /**
   * Confirm receipt of NFT
   */
  async confirmReceipt(nftId: number) {
    try {
      const result = await pool.query(
        `UPDATE nfts SET status = 'at_pharmacy', updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [nftId]
      );

      logger.info("pharmacy", `NFT ${nftId} receipt confirmed`);
      return result.rows[0];
    } catch (error) {
      logger.error("pharmacy", "Failed to confirm receipt", error);
      throw error;
    }
  }

  /**
   * Mark NFT as available for sale
   */
  async markAvailable(nftId: number) {
    try {
      const result = await pool.query(
        `UPDATE nfts SET status = 'available', updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [nftId]
      );

      logger.info("pharmacy", `NFT ${nftId} marked as available`);
      return result.rows[0];
    }catch (error) {
      logger.error("pharmacy", "Failed to mark available", error);
      throw error;
    }
  }
}

export const pharmacyService = new PharmacyService();

