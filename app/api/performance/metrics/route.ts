/**
 * Performance Metrics API
 * Endpoint to get performance metrics
 */

import { NextRequest, NextResponse } from "next/server";
import { performanceMonitor } from "@/lib/utils/performance";

/**
 * GET /api/performance/metrics
 * Get performance metrics
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const operation = searchParams.get("operation");

    if (operation) {
      const stats = performanceMonitor.getStats(operation);
      return NextResponse.json({
        operation,
        stats: stats || { message: "No metrics found" },
      });
    }

    // Get all metrics
    const allMetrics = performanceMonitor.getMetrics();
    const operations = new Set(allMetrics.map((m) => m.name));
    
    const stats: Record<string, any> = {};
    operations.forEach((op) => {
      const opStats = performanceMonitor.getStats(op);
      if (opStats) {
        stats[op] = opStats;
      }
    });

    return NextResponse.json({
      totalMetrics: allMetrics.length,
      operations: Array.from(operations),
      stats,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to get performance metrics", detail: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/performance/metrics
 * Clear performance metrics
 */
export async function DELETE() {
  try {
    performanceMonitor.clear();
    return NextResponse.json({ success: true, message: "Metrics cleared" });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to clear metrics", detail: error.message },
      { status: 500 }
    );
  }
}

