import { NextRequest, NextResponse } from "next/server";
import { getRateLimitStatus } from "@/lib/ai-agent/rate-limiter";

/**
 * GET /api/ai-agent/rate-limit?userId=xxx
 * Lấy thông tin rate limit
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "anonymous";

    const status = getRateLimitStatus(userId);

    return NextResponse.json({
      success: true,
      rateLimit: {
        remaining: status.remaining,
        resetAt: new Date(status.resetAt).toISOString(),
        resetIn: Math.max(0, Math.ceil((status.resetAt - Date.now()) / 1000)),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Lỗi khi lấy rate limit status",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

