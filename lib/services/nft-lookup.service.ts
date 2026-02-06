/**
 * NFT Lookup Service
 * lib/services/nft-lookup.service.ts
 */

import { pool } from "@/lib/db";
import { logger } from "@/lib/utils/logger";

export class NFTLookupService {
  /**
   * Search NFT by batch number
   */
  async searchByBatchNumber(batchNumber: string) {
    try {
      const result = await pool.query(
        `SELECT * FROM nfts WHERE batch_number = $1`,
        [batchNumber]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    }catch (error) {
      logger.error("nft-lookup", "Failed to search by batch", error);
      throw error;
    }
  }

  /**
   * Get NFT with full supply chain
   */
  async getNFTWithChain(nftId: number) {
    try {
      const nftResult = await pool.query(
        "SELECT * FROM nfts WHERE id = $1",
        [nftId]
      );

      if (nftResult.rows.length === 0) {
        return null;
      }

      const milestonesResult = await pool.query(
        `SELECT * FROM milestones WHERE nft_id = $1 ORDER BY timestamp ASC`,
        [nftId]
      );

      return {
        nft: nftResult.rows[0],
        milestones: milestonesResult.rows,
      };
    } catch (error) {
      logger.error("nft-lookup", "Failed to get NFT with chain", error);
      throw error;
    }
  }

  /**
   * Verify NFT authenticity
   */
  async verifyNFT(nftId: number) {
    try {
      const result = await pool.query(
        `SELECT id, batch_number, manufacturer_address, status, created_at
         FROM nfts WHERE id = $1`,
        [nftId]
      );

      if (result.rows.length === 0) {
        return { authentic: false, reason: "NFT not found" };
      }

      const nft = result.rows[0];

      return {
        authentic: true,
        nftId: nft.id,
        batchNumber: nft.batch_number,
        manufacturer: nft.manufacturer_address,
        status: nft.status,
        createdAt: nft.created_at,
      };
    } catch (error) {
      logger.error("nft-lookup", "Failed to verify NFT", error);
      throw error;
    }
  }

  /**
   * Check if NFT is expired
   */
  async checkExpiry(nftId: number) {
    try {
      const result = await pool.query(
        `SELECT id, expiry_date FROM nfts WHERE id = $1`,
        [nftId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const nft = result.rows[0];
      const now = new Date();
      const expiryDate = new Date(nft.expiry_date);

      return {
        nftId: nft.id,
        expiryDate: nft.expiry_date,
        expired: now > expiryDate,
        daysUntilExpiry: Math.ceil(
          (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        ),
      };
    } catch (error) {
      logger.error("nft-lookup", "Failed to check expiry", error);
      throw error;
    }
  }
}

export const nftLookupService = new NFTLookupService();

