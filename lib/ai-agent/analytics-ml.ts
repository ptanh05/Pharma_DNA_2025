/**
 * Advanced Analytics with ML Predictions
 * Predictive analytics và trend analysis
 */

import { pool } from "@/lib/db";

export interface Prediction {
  type: "demand" | "quality" | "fraud" | "cost" | "performance";
  value: number;
  confidence: number; // 0-1
  factors: string[];
  timestamp: Date;
}

export interface Trend {
  metric: string;
  direction: "up" | "down" | "stable";
  change: number; // percentage
  period: string;
  confidence: number;
}

/**
 * Predict demand for next period
 */
export async function predictDemand(period: "7d" | "30d" | "90d"): Promise<Prediction> {
  try {
    // Get historical data
    const historical = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM nfts
      WHERE created_at >= NOW() - INTERVAL '${period === "7d" ? "30" : period === "30d" ? "90" : "180"} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    if (historical.rows.length < 7) {
      return {
        type: "demand",
        value: 0,
        confidence: 0,
        factors: ["Insufficient data"],
        timestamp: new Date(),
      };
    }

    // Simple linear regression
    const data = historical.rows.map((row, idx) => ({
      x: idx,
      y: parseInt(row.count),
    }));

    const n = data.length;
    const sumX = data.reduce((sum, d) => sum + d.x, 0);
    const sumY = data.reduce((sum, d) => sum + d.y, 0);
    const sumXY = data.reduce((sum, d) => sum + d.x * d.y, 0);
    const sumXX = data.reduce((sum, d) => sum + d.x * d.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict next period
    const nextX = n;
    const predicted = Math.max(0, Math.round(slope * nextX + intercept));

    // Calculate confidence based on R²
    const meanY = sumY / n;
    const ssRes = data.reduce((sum, d) => {
      const predictedY = slope * d.x + intercept;
      return sum + Math.pow(d.y - predictedY, 2);
    }, 0);
    const ssTot = data.reduce((sum, d) => sum + Math.pow(d.y - meanY, 2), 0);
    const rSquared = 1 - (ssRes / ssTot);
    const confidence = Math.max(0, Math.min(1, rSquared));

    return {
      type: "demand",
      value: predicted,
      confidence,
      factors: [
        `Historical trend: ${slope > 0 ? "increasing" : slope < 0 ? "decreasing" : "stable"}`,
        `Based on ${n} data points`,
      ],
      timestamp: new Date(),
    };
  } catch (error) {
    console.error("Error predicting demand:", error);
    return {
      type: "demand",
      value: 0,
      confidence: 0,
      factors: ["Error in prediction"],
      timestamp: new Date(),
    };
  }
}

/**
 * Predict quality score for NFT
 */
export async function predictQualityScore(nftId: number): Promise<Prediction> {
  try {
    // Get NFT data
    const nft = await pool.query("SELECT * FROM nfts WHERE id = $1", [nftId]);
    if (nft.rows.length === 0) {
      throw new Error("NFT not found");
    }

    // Get quality alerts
    const alerts = await pool.query(
      "SELECT * FROM quality_alerts WHERE nft_id = $1",
      [nftId]
    );

    // Get milestones
    const milestones = await pool.query(
      "SELECT * FROM milestones WHERE nft_id = $1 ORDER BY timestamp ASC",
      [nftId]
    );

    // Calculate quality score
    let score = 1.0;
    const factors: string[] = [];

    // Factor 1: Quality alerts
    const criticalAlerts = alerts.rows.filter((a: any) => a.severity === "critical");
    const warningAlerts = alerts.rows.filter((a: any) => a.severity === "warning");
    score -= criticalAlerts.length * 0.3;
    score -= warningAlerts.length * 0.1;
    if (criticalAlerts.length > 0) {
      factors.push(`${criticalAlerts.length} critical alerts`);
    }
    if (warningAlerts.length > 0) {
      factors.push(`${warningAlerts.length} warnings`);
    }

    // Factor 2: Transit time
    if (milestones.rows.length >= 2) {
      const first = new Date(milestones.rows[0].timestamp);
      const last = new Date(milestones.rows[milestones.rows.length - 1].timestamp);
      const days = (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24);
      if (days > 30) {
        score -= 0.1;
        factors.push("Long transit time");
      }
    }

    // Factor 3: Expiry
    if (nft.rows[0].expiry_date) {
      const expiry = new Date(nft.rows[0].expiry_date);
      const daysUntilExpiry = (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntilExpiry < 30) {
        score -= 0.2;
        factors.push("Expiring soon");
      }
    }

    score = Math.max(0, Math.min(1, score));

    // Confidence based on data completeness
    let confidence = 0.5;
    if (alerts.rows.length > 0) confidence += 0.2;
    if (milestones.rows.length > 0) confidence += 0.2;
    if (nft.rows[0].expiry_date) confidence += 0.1;

    return {
      type: "quality",
      value: score,
      confidence: Math.min(1, confidence),
      factors,
      timestamp: new Date(),
    };
  } catch (error: any) {
    return {
      type: "quality",
      value: 0,
      confidence: 0,
      factors: [error.message],
      timestamp: new Date(),
    };
  }
}

/**
 * Predict fraud probability
 */
export async function predictFraudProbability(nftId: number): Promise<Prediction> {
  try {
    const nft = await pool.query("SELECT * FROM nfts WHERE id = $1", [nftId]);
    if (nft.rows.length === 0) {
      throw new Error("NFT not found");
    }

    let fraudScore = 0;
    const factors: string[] = [];

    // Check rapid transfers
    const milestones = await pool.query(
      "SELECT * FROM milestones WHERE nft_id = $1 AND type LIKE '%transfer%'",
      [nftId]
    );
    if (milestones.rows.length > 5) {
      fraudScore += 0.3;
      factors.push("Rapid ownership transfers");
    }

    // Check timing anomalies
    if (milestones.rows.length >= 2) {
      for (let i = 1; i < milestones.rows.length; i++) {
        const prev = new Date(milestones.rows[i - 1].timestamp);
        const curr = new Date(milestones.rows[i].timestamp);
        if (curr < prev) {
          fraudScore += 0.4;
          factors.push("Timing anomalies detected");
          break;
        }
      }
    }

    // Check quality alerts
    const alerts = await pool.query(
      "SELECT COUNT(*) as count FROM quality_alerts WHERE nft_id = $1 AND severity = 'critical'",
      [nftId]
    );
    if (parseInt(alerts.rows[0]?.count || "0") > 3) {
      fraudScore += 0.2;
      factors.push("Multiple critical alerts");
    }

    fraudScore = Math.min(1, fraudScore);

    return {
      type: "fraud",
      value: fraudScore,
      confidence: factors.length > 0 ? 0.7 : 0.3,
      factors: factors.length > 0 ? factors : ["No fraud indicators"],
      timestamp: new Date(),
    };
  } catch (error: any) {
    return {
      type: "fraud",
      value: 0,
      confidence: 0,
      factors: [error.message],
      timestamp: new Date(),
    };
  }
}

/**
 * Analyze trends
 */
export async function analyzeTrends(metric: string, period: string = "30d"): Promise<Trend> {
  try {
    let query = "";
    switch (metric) {
      case "nft_creation":
        query = `
          SELECT DATE(created_at) as date, COUNT(*) as value
          FROM nfts
          WHERE created_at >= NOW() - INTERVAL '${period}'
          GROUP BY DATE(created_at)
          ORDER BY date ASC
        `;
        break;
      case "transfers":
        query = `
          SELECT DATE(created_at) as date, COUNT(*) as value
          FROM transfer_requests_v2
          WHERE created_at >= NOW() - INTERVAL '${period}'
          GROUP BY DATE(created_at)
          ORDER BY date ASC
        `;
        break;
      default:
        throw new Error("Unknown metric");
    }

    const result = await pool.query(query);
    if (result.rows.length < 2) {
      return {
        metric,
        direction: "stable",
        change: 0,
        period,
        confidence: 0,
      };
    }

    const data = result.rows.map((row) => parseInt(row.value));
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = avgFirst > 0 ? ((avgSecond - avgFirst) / avgFirst) * 100 : 0;
    const direction = change > 5 ? "up" : change < -5 ? "down" : "stable";
    const confidence = Math.min(1, data.length / 30); // More data = higher confidence

    return {
      metric,
      direction,
      change: Math.round(change * 100) / 100,
      period,
      confidence,
    };
  } catch (error: any) {
    return {
      metric,
      direction: "stable",
      change: 0,
      period,
      confidence: 0,
    };
  }
}

/**
 * Get comprehensive analytics
 */
export async function getComprehensiveAnalytics(period: string = "30d"): Promise<any> {
  try {
    const demand = await predictDemand(period as any);
    const nftTrend = await analyzeTrends("nft_creation", period);
    const transferTrend = await analyzeTrends("transfers", period);

    // Get system metrics
    const systemMetrics = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'CREATED') as created,
        COUNT(*) FILTER (WHERE status = 'in_transit') as in_transit,
        COUNT(*) FILTER (WHERE status = 'in_pharmacy') as in_pharmacy,
        COUNT(*) FILTER (WHERE status = 'expired') as expired
      FROM nfts
      WHERE created_at >= NOW() - INTERVAL '${period}'
    `);

    return {
      predictions: {
        demand,
      },
      trends: {
        nftCreation: nftTrend,
        transfers: transferTrend,
      },
      systemMetrics: systemMetrics.rows[0],
      generatedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error("Error getting comprehensive analytics:", error);
    return {
      error: error.message,
    };
  }
}

