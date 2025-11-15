import { NextRequest, NextResponse } from "next/server";
import { executeAgentTask } from "@/lib/ai-agent/core";

/**
 * GET /api/ai-agent/health
 * Kiểm tra sức khỏe hệ thống
 */
export async function GET(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY chưa được cấu hình" },
        { status: 500 }
      );
    }

    const task = "Kiểm tra sức khỏe hệ thống và phát hiện vấn đề";

    const result = await executeAgentTask(task);

    return NextResponse.json({
      success: true,
      health: result.output,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Lỗi khi kiểm tra sức khỏe hệ thống",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

