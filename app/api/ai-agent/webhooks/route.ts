import { NextRequest, NextResponse } from "next/server";
import {
  createWebhook,
  getWebhooks,
  updateWebhook,
  deleteWebhook,
  getWebhookEvents,
} from "@/lib/ai-agent/webhooks";

/**
 * GET /api/ai-agent/webhooks
 * Get all webhooks
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const enabledOnly = searchParams.get("enabled") === "true";

    const webhooks = await getWebhooks(enabledOnly);

    return NextResponse.json({
      success: true,
      webhooks,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Lỗi khi lấy webhooks",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai-agent/webhooks
 * Create webhook
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, url, events, secret, enabled, headers } = body;

    if (!name || !url || !events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: "Thiếu thông tin: name, url, events là bắt buộc" },
        { status: 400 }
      );
    }

    const webhook = await createWebhook({
      name,
      url,
      events,
      secret,
      enabled: enabled !== false,
      headers,
      retryCount: 0,
      successCount: 0,
      failureCount: 0,
    });

    return NextResponse.json({
      success: true,
      webhook,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Lỗi khi tạo webhook",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ai-agent/webhooks
 * Update webhook
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Thiếu webhook ID" }, { status: 400 });
    }

    const webhook = await updateWebhook(id, updates);

    return NextResponse.json({
      success: true,
      webhook,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Lỗi khi cập nhật webhook",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai-agent/webhooks
 * Delete webhook
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Thiếu webhook ID" }, { status: 400 });
    }

    await deleteWebhook(parseInt(id));

    return NextResponse.json({
      success: true,
      message: "Webhook đã được xóa",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Lỗi khi xóa webhook",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

