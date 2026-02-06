/**
 * Distributor Service
 * lib/services/distributor.service.ts
 */

import { pool } from "@/lib/db";
import { logger } from "@/lib/utils/logger";

export class DistributorService {
  /**
   * Get NFTs assigned to distributor
   */
  async getDistributorNFTs(address: string, page: number = 1, limit: number = 10) {
    try {
      const offset = (page - 1) * limit;

      const result = await pool.query(
        `SELECT * FROM nfts WHERE distributor_address = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [address.toLowerCase(), limit, offset]
      );

      const countResult = await pool.query(
        "SELECT COUNT(*) as total FROM nfts WHERE distributor_address = $1",
        [address.toLowerCase()]
      );

      return {
        nfts: result.rows,
        total: parseInt(countResult.rows[0].total),
        page,
        limit,
      };
    }catch (error) {
      logger.error("distributor", "Failed to get NFTs", error);
      throw error;
    }
  }

  /**
   * Update NFT status
   */
  async updateNFTStatus(nftId: number, status: string) {
    try {
      const result = await pool.query(
        `UPDATE nfts SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [status, nftId]
      );

      logger.info("distributor", `NFT ${nftId}status updated to ${status}`);
      return result.rows[0];
    } catch (error) {
      logger.error("distributor", "Failed to update status", error);
      throw error;
    }
  }

  /**
   * Transfer NFT to pharmacy
   */
  async transferToPharmacy(nftId: number, pharmacyAddress: string) {
    try {
      const result = await pool.query(
        `UPDATE nfts SET pharmacy_address = $1, status = 'in_transit', updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [pharmacyAddress.toLowerCase(), nftId]
      );

      logger.info("distributor", `NFT ${nftId} transferred to pharmacy`);
      return result.rows[0];
    } catch (error) {
      logger.error("distributor", "Failed to transfer to pharmacy", error);
      throw error;
    }
  }
}

export const distributorService = new DistributorService();

