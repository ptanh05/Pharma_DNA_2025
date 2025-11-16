import { NextRequest, NextResponse } from "next/server";
import {
  predictDemand,
  predictQualityScore,
  predictFraudProbability,
  analyzeTrends,
  getComprehensiveAnalytics,
} from "@/lib/ai-agent/analytics-ml";

/**
 * GET /api/ai-agent/analytics-ml
 * Get ML-powered analytics
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // demand, quality, fraud, trends, comprehensive
    const period = searchParams.get("period") || "30d";
    const nftId = searchParams.get("nftId");

    switch (type) {
      case "demand":
        const demand = await predictDemand(period as any);
        return NextResponse.json({ success: true, prediction: demand });

      case "quality":
        if (!nftId) {
          return NextResponse.json({ error: "Thiếu nftId" }, { status: 400 });
        }
        const quality = await predictQualityScore(parseInt(nftId));
        return NextResponse.json({ success: true, prediction: quality });

      case "fraud":
        if (!nftId) {
          return NextResponse.json({ error: "Thiếu nftId" }, { status: 400 });
        }
        const fraud = await predictFraudProbability(parseInt(nftId));
        return NextResponse.json({ success: true, prediction: fraud });

      case "trends":
        const nftTrend = await analyzeTrends("nft_creation", period);
        const transferTrend = await analyzeTrends("transfers", period);
        return NextResponse.json({
          success: true,
          trends: {
            nftCreation: nftTrend,
            transfers: transferTrend,
          },
        });

      case "comprehensive":
      default:
        const analytics = await getComprehensiveAnalytics(period);
        return NextResponse.json({ success: true, analytics });
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Lỗi khi lấy analytics",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

