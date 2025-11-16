import { NextRequest, NextResponse } from "next/server";
import { getSpecializedAgent } from "@/lib/ai-agent/agents-specialized";

/**
 * POST /api/ai-agent/specialized
 * Execute task with specialized agent
 */
export async function POST(req: NextRequest) {
  try {
    const { role, task, context } = await req.json();

    if (!role || !task) {
      return NextResponse.json(
        { error: "Thiếu role hoặc task" },
        { status: 400 }
      );
    }

    if (!["manufacturer", "distributor", "pharmacy", "admin", "quality"].includes(role)) {
      return NextResponse.json(
        { error: "Role không hợp lệ" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY chưa được cấu hình" },
        { status: 500 }
      );
    }

    const agent = await getSpecializedAgent(role as any);

    let fullTask = task;
    if (context) {
      fullTask = `${task}\n\nContext: ${JSON.stringify(context, null, 2)}`;
    }

    const result = await agent.invoke({
      input: fullTask,
    });

    return NextResponse.json({
      success: true,
      role,
      result: result.output,
      steps: result.steps || [],
    });
  } catch (error: any) {
    console.error("Specialized agent error:", error);
    return NextResponse.json(
      {
        error: "Lỗi khi thực thi specialized agent",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

