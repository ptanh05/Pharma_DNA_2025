/**
 * Milestone Repository
 * Data access layer for milestone operations
 */

import { pool } from '@/lib/db';

export interface CreateMilestoneData {
  nftId: number;
  type: string;
  description?: string;
  location?: string;
  actorAddress: string;
}

export interface Milestone {
  id: number;
  nft_id: number;
  type: string;
  description?: string | null;
  location?: string | null;
  timestamp: string;
  actor_address: string;
}

export class MilestoneRepository {
  /**
   * Create new milestone
   */
  async create(data: CreateMilestoneData): Promise<Milestone> {
    const result = await pool.query(
      `INSERT INTO milestones (nft_id, type, description, location, timestamp, actor_address)
       VALUES ($1, $2, $3, $4, NOW(), $5)
       RETURNING *`,
      [
        data.nftId,
        data.type.trim(),
        data.description?.trim() || null,
        data.location?.trim() || null,
        data.actorAddress.toLowerCase(),
      ]
    );

    return result.rows[0];
  }

  /**
   * Find milestones by NFT ID
   */
  async findByNFTId(nftId: number): Promise<Milestone[]> {
    const result = await pool.query(
      'SELECT * FROM milestones WHERE nft_id = $1 ORDER BY timestamp ASC',
      [nftId]
    );
    return result.rows;
  }

  /**
   * Find milestones by actor address
   */
  async findByActor(actorAddress: string): Promise<Milestone[]> {
    const result = await pool.query(
      'SELECT * FROM milestones WHERE actor_address = $1 ORDER BY timestamp DESC',
      [actorAddress.toLowerCase()]
    );
    return result.rows;
  }

  /**
   * Find milestones by type
   */
  async findByType(type: string): Promise<Milestone[]> {
    const result = await pool.query(
      'SELECT * FROM milestones WHERE type = $1 ORDER BY timestamp DESC',
      [type]
    );
    return result.rows;
  }

  /**
   * Get latest milestone for NFT
   */
  async getLatestByNFTId(nftId: number): Promise<Milestone | null> {
    const result = await pool.query(
      'SELECT * FROM milestones WHERE nft_id = $1 ORDER BY timestamp DESC LIMIT 1',
      [nftId]
    );
    return result.rows[0] || null;
  }

  /**
   * Delete milestone
   */
  async delete(id: number): Promise<boolean> {
    try {
      await pool.query('DELETE FROM milestones WHERE id = $1', [id]);
      return true;
    } catch (error) {
      console.error('Error deleting milestone:', error);
      return false;
    }
  }
}

