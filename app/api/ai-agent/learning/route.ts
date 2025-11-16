import { NextRequest, NextResponse } from "next/server";
import {
  getRecommendations,
  getFailurePatterns,
  getPerformanceMetrics,
  createAdaptationRule,
  getApplicableRules,
} from "@/lib/ai-agent/learning";

/**
 * GET /api/ai-agent/learning
 * Get learning insights
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "recommendations"; // recommendations, failures, metrics, rules
    const context = searchParams.get("context");
    const action = searchParams.get("action");
    const timeRange = searchParams.get("timeRange") || "7d";

    switch (type) {
      case "recommendations":
        const recContext = context ? JSON.parse(context) : {};
        const recommendations = await getRecommendations(recContext, action || undefined);
        return NextResponse.json({ success: true, recommendations });

      case "failures":
        const failContext = context ? JSON.parse(context) : {};
        const failures = await getFailurePatterns(failContext);
        return NextResponse.json({ success: true, failures });

      case "metrics":
        const metrics = await getPerformanceMetrics(timeRange);
        return NextResponse.json({ success: true, metrics });

      case "rules":
        const rulesContext = context ? JSON.parse(context) : {};
        const rules = await getApplicableRules(rulesContext);
        return NextResponse.json({ success: true, rules });

      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Lỗi khi lấy learning data",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai-agent/learning
 * Create adaptation rule
 */
export async function POST(req: NextRequest) {
  try {
    const { condition, action, priority } = await req.json();

    if (!condition || !action) {
      return NextResponse.json(
        { error: "Thiếu condition hoặc action" },
        { status: 400 }
      );
    }

    const rule = await createAdaptationRule(condition, action, priority || 1);

    return NextResponse.json({
      success: true,
      rule,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Lỗi khi tạo adaptation rule",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

