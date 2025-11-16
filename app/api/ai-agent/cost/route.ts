import { NextRequest, NextResponse } from "next/server";
import {
  getCostMetrics,
  getOptimizationStrategies,
  getCostBreakdownByTool,
  estimateTaskCost,
} from "@/lib/ai-agent/cost-optimization";

/**
 * GET /api/ai-agent/cost
 * Get cost metrics and optimization strategies
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "metrics"; // metrics, strategies, breakdown, estimate
    const period = searchParams.get("period") || "7d";
    const task = searchParams.get("task");
    const model = searchParams.get("model") || "gpt-3.5-turbo";

    switch (type) {
      case "metrics":
        const metrics = await getCostMetrics(period);
        return NextResponse.json({ success: true, metrics });

      case "strategies":
        const strategies = await getOptimizationStrategies();
        return NextResponse.json({ success: true, strategies });

      case "breakdown":
        const breakdown = await getCostBreakdownByTool(period);
        return NextResponse.json({ success: true, breakdown });

      case "estimate":
        if (!task) {
          return NextResponse.json({ error: "Thiếu task" }, { status: 400 });
        }
        const cost = estimateTaskCost(task, model);
        return NextResponse.json({
          success: true,
          estimatedCost: cost,
          model,
          taskLength: task.length,
        });

      default:
        const allMetrics = await getCostMetrics(period);
        const allStrategies = await getOptimizationStrategies();
        return NextResponse.json({
          success: true,
          metrics: allMetrics,
          strategies: allStrategies,
        });
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Lỗi khi lấy cost data",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

