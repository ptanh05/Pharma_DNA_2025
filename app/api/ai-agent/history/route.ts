import { NextRequest, NextResponse } from "next/server";
import { getAgentMemory } from "@/lib/ai-agent/core";

/**
 * GET /api/ai-agent/history?sessionId=xxx
 * Lấy lịch sử conversation
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId") || "default";

    const memory = getAgentMemory(sessionId);

    return NextResponse.json({
      success: true,
      sessionId,
      history: memory,
      count: memory.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Lỗi khi lấy lịch sử",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

