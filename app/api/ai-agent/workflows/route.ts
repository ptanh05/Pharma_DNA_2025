import { NextRequest, NextResponse } from "next/server";
import {
  createWorkflow,
  getWorkflows,
  updateWorkflow,
  deleteWorkflow,
  executeWorkflow,
} from "@/lib/ai-agent/workflow";

/**
 * GET /api/ai-agent/workflows
 * Get all workflows
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const enabledOnly = searchParams.get("enabled") === "true";

    const workflows = await getWorkflows(enabledOnly);

    return NextResponse.json({
      success: true,
      workflows,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Lỗi khi lấy workflows",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai-agent/workflows
 * Create new workflow
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, task, schedule, enabled, context, createdBy } = body;

    if (!name || !task || !schedule) {
      return NextResponse.json(
        { error: "Thiếu thông tin: name, task, schedule là bắt buộc" },
        { status: 400 }
      );
    }

    const workflow = await createWorkflow({
      name,
      description,
      task,
      schedule,
      enabled: enabled !== false,
      context,
      createdBy,
      runCount: 0,
      successCount: 0,
      failureCount: 0,
    });

    return NextResponse.json({
      success: true,
      workflow,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Lỗi khi tạo workflow",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ai-agent/workflows
 * Update workflow
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Thiếu workflow ID" }, { status: 400 });
    }

    const workflow = await updateWorkflow(id, updates);

    return NextResponse.json({
      success: true,
      workflow,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Lỗi khi cập nhật workflow",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai-agent/workflows
 * Delete workflow
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Thiếu workflow ID" }, { status: 400 });
    }

    await deleteWorkflow(parseInt(id));

    return NextResponse.json({
      success: true,
      message: "Workflow đã được xóa",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Lỗi khi xóa workflow",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

