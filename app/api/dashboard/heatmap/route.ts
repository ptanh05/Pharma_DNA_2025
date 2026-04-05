/**
 * Dashboard API - Activity Heatmap
 * app/api/dashboard/heatmap/route.ts
 *
 * Returns activity density by day-of-week and hour
 */

import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z } from "zod";

const heatmapQuerySchema = z.object({
  days: z.string().default("30").transform(Number),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { days } = validateQueryParams(searchParams, heatmapQuerySchema);

    const result = await pool.query(`
      SELECT
        EXTRACT(DOW FROM created_at) as day_of_week,
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as count
      FROM nfts
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY day_of_week, hour
      ORDER BY day_of_week, hour
    `);

    // Build 7x24 matrix (days x hours)
    const heatmap: { [key: number]: { [key: number]: number } } = {};
    for (let d = 0; d < 7; d++) {
      heatmap[d] = {};
      for (let h = 0; h < 24; h++) {
        heatmap[d][h] = 0;
      }
    }

    for (const row of result.rows) {
      const dow = parseInt(row.day_of_week);
      const hr = parseInt(row.hour);
      heatmap[dow][hr] = parseInt(row.count);
    }

    // Find max for normalization
    let maxCount = 0;
    for (const dow in heatmap) {
      for (const hr in heatmap[dow]) {
        if (heatmap[dow][hr] > maxCount) maxCount = heatmap[dow][hr];
      }
    }

    return createSuccessResponse({
      heatmap,
      maxCount,
      days,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return createErrorResponse(error, "DASHBOARD_HEATMAP");
  }
}
