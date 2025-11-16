import { NextRequest, NextResponse } from "next/server";
import { executeWorkflow } from "@/lib/ai-agent/workflow";

/**
 * POST /api/ai-agent/workflows/execute
 * Manually execute a workflow
 */
export async function POST(req: NextRequest) {
  try {
    const { workflowId } = await req.json();

    if (!workflowId) {
      return NextResponse.json(
        { error: "Thiếu workflow ID" },
        { status: 400 }
      );
    }

    const execution = await executeWorkflow(workflowId, true);

    return NextResponse.json({
      success: true,
      execution,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Lỗi khi thực thi workflow",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

