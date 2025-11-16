/**
 * Milestone Service
 * Business logic layer for milestone operations
 */

import { MilestoneRepository } from '@/lib/repositories/milestone.repository';
import { NFTRepository } from '@/lib/repositories/nft.repository';

export interface CreateMilestoneData {
  nftId: number;
  type: string;
  description?: string;
  location?: string;
  actorAddress: string;
}

export class MilestoneService {
  constructor(
    private milestoneRepo: MilestoneRepository,
    private nftRepo: NFTRepository
  ) {}

  /**
   * Create milestone for NFT
   */
  async createMilestone(data: CreateMilestoneData): Promise<{ success: boolean; milestone?: any; error?: string }> {
    try {
      // Validate NFT exists
      const nft = await this.nftRepo.findById(data.nftId);
      if (!nft) {
        return {
          success: false,
          error: `NFT với ID ${data.nftId} không tồn tại`,
        };
      }

      // Validate input
      if (!data.type || data.type.trim().length === 0) {
        return {
          success: false,
          error: 'Loại milestone là bắt buộc',
        };
      }

      if (data.type.length > 100) {
        return {
          success: false,
          error: 'Loại milestone tối đa 100 ký tự',
        };
      }

      // Create milestone
      const milestone = await this.milestoneRepo.create(data);

      return {
        success: true,
        milestone,
      };
    } catch (error: any) {
      console.error('Error creating milestone:', error);
      return {
        success: false,
        error: error.message || 'Lỗi khi tạo milestone',
      };
    }
  }

  /**
   * Get milestones for NFT
   */
  async getMilestonesByNFTId(nftId: number): Promise<any[]> {
    try {
      return await this.milestoneRepo.findByNFTId(nftId);
    } catch (error) {
      console.error('Error getting milestones:', error);
      return [];
    }
  }

  /**
   * Get latest milestone for NFT
   */
  async getLatestMilestone(nftId: number): Promise<any | null> {
    try {
      return await this.milestoneRepo.getLatestByNFTId(nftId);
    } catch (error) {
      console.error('Error getting latest milestone:', error);
      return null;
    }
  }

  /**
   * Get milestones by actor
   */
  async getMilestonesByActor(actorAddress: string): Promise<any[]> {
    try {
      return await this.milestoneRepo.findByActor(actorAddress);
    } catch (error) {
      console.error('Error getting milestones by actor:', error);
      return [];
    }
  }
}

