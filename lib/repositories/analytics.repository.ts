/**
 * Analytics Repository
 * Data access layer for all analytics/aggregation queries
 *
 * Single source of truth for analytics SQL — testable and mockable.
 */

import { pool } from '@/lib/db';

export interface SupplyChainFunnelData {
  minted: number;
  at_distributor: number;
  at_pharmacy: number;
  dispensed: number;
  total: number;
}

export interface NFTHealth {
  expiring_30d: number;
  expiring_7d: number;
  expired: number;
  total: number;
}

export interface SensorAlert {
  nft_id: number;
  batch_number?: string;
  temperature: number | null;
  humidity: number | null;
  gps_location: string | null;
  recorded_at: string;
  severity: 'normal' | 'warning' | 'critical';
}

export interface QualityAlert {
  id: number;
  nft_id: number;
  batch_number: string | null;
  severity: string;
  alert_type: string | null;
  description: string | null;
  location: string | null;
  nft_name: string | null;
  manufacturer_address: string | null;
}

export interface TrendPoint {
  date: string;
  count: number;
  cumulative?: number;
}

export class AnalyticsRepository {
  /**
   * Supply chain funnel — count NFTs at each stage
   * Stage logic:
   *   minted       → status = 'minted' (fresh from manufacturer)
   *   at_distributor → distributor_address is set, pharmacy_address is null, not dispensed
   *   at_pharmacy  → pharmacy_address is set, not dispensed
   *   dispensed    → status = 'dispensed'
   */
  async getSupplyChainFunnel(): Promise<SupplyChainFunnelData> {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'minted') AS minted,
        COUNT(*) FILTER (
          WHERE distributor_address IS NOT NULL
            AND pharmacy_address IS NULL
            AND status != 'dispensed'
        ) AS at_distributor,
        COUNT(*) FILTER (
          WHERE pharmacy_address IS NOT NULL
            AND status != 'dispensed'
        ) AS at_pharmacy,
        COUNT(*) FILTER (WHERE status = 'dispensed') AS dispensed,
        COUNT(*) AS total
      FROM nfts
      WHERE status != 'deleted'
    `);
    const row = result.rows[0];
    return {
      minted: parseInt(row.minted || '0'),
      at_distributor: parseInt(row.at_distributor || '0'),
      at_pharmacy: parseInt(row.at_pharmacy || '0'),
      dispensed: parseInt(row.dispensed || '0'),
      total: parseInt(row.total || '0'),
    };
  }

  /**
   * NFT health — expiry-based breakdown
   * Cold-chain pharmaceuticals typically have 2–3 year shelf life
   */
  async getNFTHealth(): Promise<NFTHealth> {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
            AND expiry_date IS NOT NULL
        ) AS expiring_30d,
        COUNT(*) FILTER (
          WHERE expiry_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
            AND expiry_date IS NOT NULL
        ) AS expiring_7d,
        COUNT(*) FILTER (
          WHERE expiry_date < NOW()
            AND expiry_date IS NOT NULL
        ) AS expired,
        COUNT(*) FILTER (WHERE expiry_date IS NOT NULL) AS total
      FROM nfts
      WHERE status != 'deleted'
    `);
    const row = result.rows[0];
    return {
      expiring_30d: parseInt(row.expiring_30d || '0'),
      expiring_7d: parseInt(row.expiring_7d || '0'),
      expired: parseInt(row.expired || '0'),
      total: parseInt(row.total || '0'),
    };
  }

  /**
   * Sensor alerts — cold-chain threshold violations
   * Pharmaceutical cold chain: 2–8°C (standard), 35–65% humidity
   * Critical = outside safe range, Warning = approaching limits
   */
  async getSensorAlerts(minutesBack: number = 60): Promise<SensorAlert[]> {
    const result = await pool.query(
      `
      SELECT
        sd.nft_id,
        n.batch_number,
        sd.temperature,
        sd.humidity,
        sd.gps_location,
        sd.recorded_at,
        CASE
          WHEN sd.temperature < 2 OR sd.temperature > 8 THEN 'critical'
          WHEN sd.humidity < 35 OR sd.humidity > 65 THEN 'critical'
          WHEN sd.temperature < 4 OR sd.temperature > 10 THEN 'warning'
          WHEN sd.humidity < 40 OR sd.humidity > 60 THEN 'warning'
          ELSE 'normal'
        END AS severity
      FROM sensor_data sd
      LEFT JOIN nfts n ON sd.nft_id = n.id
      WHERE sd.recorded_at >= NOW() - ($1 || ' minutes')::INTERVAL
        AND (
          sd.temperature < 2 OR sd.temperature > 8
          OR sd.humidity < 35 OR sd.humidity > 65
          OR sd.temperature < 4 OR sd.temperature > 10
          OR sd.humidity < 40 OR sd.humidity > 60
        )
      ORDER BY sd.recorded_at DESC
      LIMIT 50
      `,
      [minutesBack]
    );
    return result.rows.map((row) => ({
      nft_id: row.nft_id,
      batch_number: row.batch_number || undefined,
      temperature: row.temperature ? parseFloat(row.temperature) : null,
      humidity: row.humidity ? parseFloat(row.humidity) : null,
      gps_location: row.gps_location || null,
      recorded_at: row.recorded_at,
      severity: row.severity,
    }));
  }

  /**
   * Unresolved quality alerts — sorted by severity
   */
  async getUnresolvedQualityAlerts(): Promise<QualityAlert[]> {
    const result = await pool.query(`
      SELECT
        qa.id,
        qa.nft_id,
        qa.batch_number,
        qa.severity,
        qa.alert_type,
        qa.description,
        qa.location,
        n.name AS nft_name,
        n.manufacturer_address
      FROM quality_alerts qa
      LEFT JOIN nfts n ON qa.nft_id = n.id
      WHERE qa.resolved = FALSE
      ORDER BY
        CASE qa.severity
          WHEN 'critical' THEN 1
          WHEN 'warning'  THEN 2
          ELSE 3
        END,
        qa.created_at DESC
      LIMIT 50
    `);
    return result.rows;
  }

  /**
   * NFT creation trend — daily count with cumulative total
   */
  async getNFTCreationTrend(days: number = 30): Promise<TrendPoint[]> {
    const result = await pool.query(
      `
      WITH daily AS (
        SELECT
          DATE(created_at) AS date,
          COUNT(*) AS count
        FROM nfts
        WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
          AND status != 'deleted'
        GROUP BY DATE(created_at)
      )
      SELECT
        date::text,
        count,
        SUM(count) OVER (ORDER BY date) AS cumulative
      FROM daily
      ORDER BY date
      `,
      [days]
    );
    return result.rows.map((row) => ({
      date: row.date,
      count: parseInt(row.count),
      cumulative: parseInt(row.cumulative),
    }));
  }

  /**
   * Milestone heatmap — activity by date (for activity heatmap)
   * Uses milestones.timestamp instead of nfts.created_at to capture
   * real supply-chain events (transfers, receipts, dispensing).
   */
  async getMilestoneHeatmap(days: number = 30): Promise<{
    heatmap: { [key: string]: { [key: number]: number } };
    maxCount: number;
  }> {
    const result = await pool.query(
      `
      SELECT
        DATE(m.timestamp) AS date,
        EXTRACT(DOW FROM m.timestamp) AS day_of_week,
        EXTRACT(HOUR FROM m.timestamp) AS hour,
        COUNT(*) AS count
      FROM milestones m
      WHERE m.timestamp >= NOW() - ($1 || ' days')::INTERVAL
      GROUP BY DATE(m.timestamp), day_of_week, hour
      ORDER BY date, hour
      `,
      [days]
    );

    // Build 7x24 matrix: heatmap[day_of_week][hour] = count
    const heatmap: { [key: string]: { [key: number]: number } } = {};
    for (let d = 0; d < 7; d++) {
      const key = d.toString();
      heatmap[key] = {};
      for (let h = 0; h < 24; h++) {
        heatmap[key][h] = 0;
      }
    }

    let maxCount = 0;
    for (const row of result.rows) {
      const dow = parseInt(row.day_of_week).toString();
      const hr = parseInt(row.hour);
      const cnt = parseInt(row.count);
      heatmap[dow][hr] = cnt;
      if (cnt > maxCount) maxCount = cnt;
    }

    return { heatmap, maxCount };
  }

  /**
   * Dispensing trend — daily volume and cumulative
   */
  async getDispensingTrend(days: number = 30): Promise<TrendPoint[]> {
    const result = await pool.query(
      `
      SELECT
        DATE(dispensed_at) AS date,
        COUNT(*) AS count,
        SUM(quantity) AS total_quantity
      FROM dispensing_records
      WHERE dispensed_at >= NOW() - ($1 || ' days')::INTERVAL
      GROUP BY DATE(dispensed_at)
      ORDER BY date
      `,
      [days]
    );
    return result.rows.map((row) => ({
      date: row.date,
      count: parseInt(row.count),
      cumulative: parseInt(row.total_quantity),
    }));
  }

  /**
   * NFTs expiring within N days (for alert notifications)
   */
  async getExpiringNFTs(daysAhead: number = 30): Promise<any[]> {
    const result = await pool.query(
      `
      SELECT
        id,
        name,
        batch_number,
        expiry_date,
        manufacturer_address,
        status
      FROM nfts
      WHERE expiry_date BETWEEN NOW() AND NOW() + ($1 || ' days')::INTERVAL
        AND status NOT IN ('dispensed', 'deleted')
        AND expiry_date IS NOT NULL
      ORDER BY expiry_date
      `,
      [daysAhead]
    );
    return result.rows;
  }

  /**
   * Activity heatmap for dashboard — milestone-based (replaces nfts-created_at approach)
   */
  async getActivityHeatmap(days: number = 30): Promise<{
    heatmap: { [key: number]: { [key: number]: number } };
    maxCount: number;
  }> {
    const result = await pool.query(
      `
      SELECT
        EXTRACT(DOW FROM m.timestamp) AS day_of_week,
        EXTRACT(HOUR FROM m.timestamp) AS hour,
        COUNT(*) AS count
      FROM milestones m
      WHERE m.timestamp >= NOW() - ($1 || ' days')::INTERVAL
      GROUP BY day_of_week, hour
      ORDER BY day_of_week, hour
      `,
      [days]
    );

    const heatmap: { [key: number]: { [key: number]: number } } = {};
    for (let d = 0; d < 7; d++) {
      heatmap[d] = {};
      for (let h = 0; h < 24; h++) {
        heatmap[d][h] = 0;
      }
    }

    let maxCount = 0;
    for (const row of result.rows) {
      const dow = parseInt(row.day_of_week);
      const hr = parseInt(row.hour);
      const cnt = parseInt(row.count);
      heatmap[dow][hr] = cnt;
      if (cnt > maxCount) maxCount = cnt;
    }

    return { heatmap, maxCount };
  }
}

export const analyticsRepository = new AnalyticsRepository();