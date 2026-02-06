/**
 * Batch Operations Service
 * lib/services/batch.service.ts
 */

import { pool } from "@/lib/db";
import { logger } from "@/lib/utils/logger";

export class BatchService {
  /**
   * Batch create NFTs
   */
  async batchCreateNFTs(nfts: Array<{
    batchNumber: string;
    name: string;
    manufacturerAddress: string;
    ipfsHash: string;
    expiryDate: string;
  }>) {
    try {
      const results = [];
      
      for (const nft of nfts) {
        const result = await pool.query(
          `INSERT INTO nfts (batch_number, name, manufacturer_address, ipfs_hash, expiry_date, status)
           VALUES ($1, $2, $3, $4, $5, 'created')
           RETURNING *`,
          [nft.batchNumber, nft.name, nft.manufacturerAddress, nft.ipfsHash, nft.expiryDate]
        );
        results.push(result.rows[0]);
      }

      logger.info("batch", `Batch created ${nfts.length}NFTs`);
      return results;
    } catch (error) {
      logger.error("batch", "Failed to batch create NFTs", error);
      throw error;
    }
  }

  /**
   * Batch update NFT status
   */
  async batchUpdateStatus(nftIds: number[], status: string) {
    try {
      const result = await pool.query(
        `UPDATE nfts SET status = $1, updated_at = NOW()
         WHERE id = ANY($2)
         RETURNING *`,
        [status, nftIds]
      );

      logger.info("batch", `Updated ${nftIds.length} NFTs to ${status}`);
      return result.rows;
    }catch (error) {
      logger.error("batch", "Failed to batch update status", error);
      throw error;
    }
  }
}

export const batchService = new BatchService();

