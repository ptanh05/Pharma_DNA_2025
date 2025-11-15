import { NextRequest, NextResponse } from "next/server";
import { executeAgentTask } from "@/lib/ai-agent/core";
import { getRateLimitStatus } from "@/lib/ai-agent/rate-limiter";

/**
 * POST /api/ai-agent/execute
 * Execute một task với AI Agent
 */
export async function POST(req: NextRequest) {
  try {
    const { task, context, sessionId, userId } = await req.json();
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

    if (!task) {
      return NextResponse.json({ error: "Thiếu task" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY chưa được cấu hình" },
        { status: 500 }
      );
    }

    // Check rate limit status
    const rateLimitKey = userId || sessionId || "anonymous";
    const rateLimitStatus = getRateLimitStatus(rateLimitKey);

    const result = await executeAgentTask(
      task,
      context,
      sessionId || "default",
      userId,
      ipAddress
    );

    return NextResponse.json({
      success: true,
      result: result.output,
      steps: result.steps || [],
      fromCache: result.fromCache || false,
      rateLimit: {
        remaining: rateLimitStatus.remaining,
        resetAt: new Date(rateLimitStatus.resetAt).toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Agent execution error:", error);
    
    // Check if it's a rate limit error
    if (error.message?.includes("Rate limit exceeded")) {
      return NextResponse.json(
        {
          error: error.message,
          type: "rate_limit",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: "Lỗi khi thực thi agent",
        detail: error.message,
        type: "execution_error",
      },
      { status: 500 }
    );
  }
}

