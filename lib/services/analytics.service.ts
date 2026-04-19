/**
 * Analytics Service
 * Business logic for analytics — calls AnalyticsRepository
 */

import { pool } from '@/lib/db';
import { logger } from '@/lib/utils/logger';
import { analyticsRepository } from '@/lib/repositories/analytics.repository';

export interface NFTStats {
  total: number;
  byStatus: { status: string; count: string }[];
  byRegion: { manufacturer_address: string; count: string }[];
  health: Awaited<ReturnType<typeof analyticsRepository.getNFTHealth>>;
  funnel: Awaited<ReturnType<typeof analyticsRepository.getSupplyChainFunnel>>;
}

export interface AlertsSummary {
  expiring: any[];
  sensorAlerts: Awaited<ReturnType<typeof analyticsRepository.getSensorAlerts>>;
  qualityAlerts: Awaited<ReturnType<typeof analyticsRepository.getUnresolvedQualityAlerts>>;
}

export interface TrendsSummary {
  nftCreation: Awaited<ReturnType<typeof analyticsRepository.getNFTCreationTrend>>;
  dispensing: Awaited<ReturnType<typeof analyticsRepository.getDispensingTrend>>;
}

export class AnalyticsService {
  /**
   * Full NFT stats — status breakdown, top manufacturers, health, funnel
   */
  async getNFTStats(): Promise<NFTStats> {
    try {
      const [byStatus, byRegion, health, funnel] = await Promise.all([
        pool.query(
          "SELECT status, COUNT(*) as count FROM nfts WHERE status != 'deleted' GROUP BY status ORDER BY count DESC"
        ),
        pool.query(
          `SELECT manufacturer_address, COUNT(*) as count
           FROM nfts
           WHERE manufacturer_address IS NOT NULL
           GROUP BY manufacturer_address
           ORDER BY count DESC
           LIMIT 10`
        ),
        analyticsRepository.getNFTHealth(),
        analyticsRepository.getSupplyChainFunnel(),
      ]);

      const total = byStatus.rows.reduce(
        (sum: number, row: { count: string }) => sum + parseInt(row.count),
        0
      );

      return {
        total,
        byStatus: byStatus.rows,
        byRegion: byRegion.rows,
        health,
        funnel,
      };
    } catch (error) {
      logger.error('analytics', 'Failed to get NFT stats', error);
      throw error;
    }
  }

  /**
   * Alerts summary — expiring NFTs, cold-chain violations, unresolved quality alerts
   */
  async getAlertsSummary(daysExpiring: number = 30): Promise<AlertsSummary> {
    try {
      const [expiring, sensorAlerts, qualityAlerts] = await Promise.all([
        analyticsRepository.getExpiringNFTs(daysExpiring),
        analyticsRepository.getSensorAlerts(60),
        analyticsRepository.getUnresolvedQualityAlerts(),
      ]);
      return { expiring, sensorAlerts, qualityAlerts };
    } catch (error) {
      logger.error('analytics', 'Failed to get alerts summary', error);
      throw error;
    }
  }

  /**
   * Trends — NFT creation and dispensing over time
   * @param period '7d' | '30d' | '90d'
   */
  async getTrends(period: '7d' | '30d' | '90d' = '30d'): Promise<TrendsSummary> {
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    try {
      const [nftCreation, dispensing] = await Promise.all([
        analyticsRepository.getNFTCreationTrend(days),
        analyticsRepository.getDispensingTrend(days),
      ]);
      return { nftCreation, dispensing };
    } catch (error) {
      logger.error('analytics', 'Failed to get trends', error);
      throw error;
    }
  }

  /**
   * Activity heatmap — milestone-based (replaces nfts.created_at approach)
   */
  async getActivityHeatmap(days: number = 30) {
    try {
      return await analyticsRepository.getActivityHeatmap(days);
    } catch (error) {
      logger.error('analytics', 'Failed to get activity heatmap', error);
      throw error;
    }
  }

  /**
   * Supply chain funnel — dedicated endpoint for SupplyChainFunnelChart
   */
  async getSupplyChainFunnel() {
    try {
      return await analyticsRepository.getSupplyChainFunnel();
    } catch (error) {
      logger.error('analytics', 'Failed to get supply chain funnel', error);
      throw error;
    }
  }
}

export const analyticsService = new AnalyticsService();