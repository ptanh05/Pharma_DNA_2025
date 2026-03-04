/**
 * NFT Repository
 * Data access layer for NFT operations
 */

import { pool } from '@/lib/db';

export interface CreateNFTData {
  name: string;
  status: string;
  manufacturerAddress: string;
  ipfsHash: string;
  batchNumber: string;
  transactionHash?: string;
  distributorAddress?: string;
  pharmacyAddress?: string;
}

export interface NFT {
  id: number;
  name: string;
  status: string;
  manufacturer_address: string;
  distributor_address?: string | null;
  pharmacy_address?: string | null;
  ipfs_hash: string;
  batch_number: string;
  transaction_hash?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export class NFTRepository {
  /**
   * Create new NFT record
   */
  async create(data: CreateNFTData): Promise<NFT> {
    const now = new Date().toISOString();
    const result = await pool.query(
      `INSERT INTO nfts (
        name, status, created_at, manufacturer_address, 
        ipfs_hash, batch_number, transaction_hash,
        distributor_address, pharmacy_address
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        data.name,
        data.status,
        now,
        data.manufacturerAddress.toLowerCase(),
        data.ipfsHash,
        data.batchNumber,
        data.transactionHash || null,
        data.distributorAddress?.toLowerCase() || null,
        data.pharmacyAddress?.toLowerCase() || null,
      ]
    );

    return result.rows[0];
  }

  /**
   * Find NFT by ID
   */
  async findById(id: number): Promise<NFT | null> {
    const result = await pool.query('SELECT * FROM nfts WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  /**
   * Find NFTs by owner address (manufacturer, distributor, or pharmacy)
   */
  async findByOwner(owner: string, limit?: number, offset?: number): Promise<{ nfts: NFT[]; total: number }> {
    const address = owner.toLowerCase();

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM nfts
       WHERE manufacturer_address = $1
          OR distributor_address = $1
          OR pharmacy_address = $1`,
      [address]
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // Get paginated results
    const query = limit !== undefined
      ? `SELECT * FROM nfts
          WHERE manufacturer_address = $1
             OR distributor_address = $1
             OR pharmacy_address = $1
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3`
      : `SELECT * FROM nfts
          WHERE manufacturer_address = $1
             OR distributor_address = $1
             OR pharmacy_address = $1
          ORDER BY created_at DESC`;

    const result = limit !== undefined
      ? await pool.query(query, [address, limit, offset || 0])
      : await pool.query(query, [address]);

    return { nfts: result.rows, total };
  }

  /**
   * Find NFTs by status
   */
  async findByStatus(status: string, limit?: number, offset?: number): Promise<{ nfts: NFT[]; total: number }> {
    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM nfts WHERE status = $1',
      [status]
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // Get paginated results
    const query = limit !== undefined
      ? 'SELECT * FROM nfts WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3'
      : 'SELECT * FROM nfts WHERE status = $1 ORDER BY created_at DESC';

    const result = limit !== undefined
      ? await pool.query(query, [status, limit, offset || 0])
      : await pool.query(query, [status]);

    return { nfts: result.rows, total };
  }

  /**
   * Update NFT status
   */
  async updateStatus(
    id: number,
    status: string,
    address?: string,
    addressType?: 'distributor' | 'pharmacy'
  ): Promise<NFT> {
    const now = new Date().toISOString();
    
    if (addressType === 'distributor' && address) {
      const result = await pool.query(
        `UPDATE nfts 
         SET status = $1, distributor_address = $2, updated_at = $3
         WHERE id = $4
         RETURNING *`,
        [status, address.toLowerCase(), now, id]
      );
      return result.rows[0];
    } else if (addressType === 'pharmacy' && address) {
      const result = await pool.query(
        `UPDATE nfts 
         SET status = $1, pharmacy_address = $2, updated_at = $3
         WHERE id = $4
         RETURNING *`,
        [status, address.toLowerCase(), now, id]
      );
      return result.rows[0];
    } else {
      const result = await pool.query(
        `UPDATE nfts 
         SET status = $1, updated_at = $2
         WHERE id = $3
         RETURNING *`,
        [status, now, id]
      );
      return result.rows[0];
    }
  }

  /**
   * Find NFT by transaction hash
   */
  async findByTransactionHash(txHash: string): Promise<NFT | null> {
    const result = await pool.query(
      'SELECT * FROM nfts WHERE transaction_hash = $1',
      [txHash]
    );
    return result.rows[0] || null;
  }

  /**
   * Find NFTs by batch number
   */
  async findByBatchNumber(batchNumber: string, limit?: number, offset?: number): Promise<{ nfts: NFT[]; total: number }> {
    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM nfts WHERE batch_number = $1',
      [batchNumber]
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // Get paginated results
    const query = limit !== undefined
      ? 'SELECT * FROM nfts WHERE batch_number = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3'
      : 'SELECT * FROM nfts WHERE batch_number = $1 ORDER BY created_at DESC';

    const result = limit !== undefined
      ? await pool.query(query, [batchNumber, limit, offset || 0])
      : await pool.query(query, [batchNumber]);

    return { nfts: result.rows, total };
  }

  /**
   * Delete NFT (soft delete by updating status)
   */
  async delete(id: number): Promise<boolean> {
    try {
      await pool.query(
        'UPDATE nfts SET status = $1, updated_at = $2 WHERE id = $3',
        ['deleted', new Date().toISOString(), id]
      );
      return true;
    } catch (error) {
      console.error('Error deleting NFT:', error);
      return false;
    }
  }
}

