/**
 * Manufacturer Service
 * lib/services/manufacturer.service.ts
 */

import { pool }from "@/lib/db";
import { logger } from "@/lib/utils/logger";

export class ManufacturerService {
  /**
   * Create NFT record
   */
  async createNFT(data: {
    batchNumber: string;
    name: string;
    manufacturerAddress: string;
    ipfsHash: string;
    expiryDate: string;
  }) {
    try {
      const result = await pool.query(
        `INSERT INTO nfts (batch_number, name, manufacturer_address, ipfs_hash, expiry_date, status)
         VALUES ($1, $2, $3, $4, $5, 'created')
         RETURNING *`,
        [
          data.batchNumber,
          data.name,
          data.manufacturerAddress,
          data.ipfsHash,
          data.expiryDate,
        ]
      );

      logger.info("manufacturer", `NFT created: ${data.batchNumber}`);
      return result.rows[0];
    } catch (error) {
      logger.error("manufacturer", "Failed to create NFT", error);
      throw error;
    }
  }

  /**
   * Get manufacturer NFTs
   */
  async getManufacturerNFTs(address: string, page: number = 1, limit: number = 10) {
    try {
      const offset = (page - 1) * limit;

      const result = await pool.query(
        `SELECT * FROM nfts WHERE manufacturer_address = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [address.toLowerCase(), limit, offset]
      );

      const countResult = await pool.query(
        "SELECT COUNT(*) as total FROM nfts WHERE manufacturer_address = $1",
        [address.toLowerCase()]
      );

      return {
        nfts: result.rows,
        total: parseInt(countResult.rows[0].total),
        page,
        limit,
      };
    } catch (error) {
      logger.error("manufacturer", "Failed to get NFTs", error);
      throw error;
    }
  }

  /**
   * Add milestone to NFT
   */
  async addMilestone(nftId: number, type: string, description: string) {
    try {
      const result = await pool.query(
        `INSERT INTO milestones (nft_id, type, description)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [nftId, type, description]
      );

      logger.info("manufacturer", `Milestone added to NFT ${nftId}`);
      return result.rows[0];
    }catch (error) {
      logger.error("manufacturer", "Failed to add milestone", error);
      throw error;
    }
  }
}

export const manufacturerService = new ManufacturerService();

