import { NextRequest, NextResponse } from "next/server";
import { getWebhookEvents } from "@/lib/ai-agent/webhooks";

/**
 * GET /api/ai-agent/webhooks/events
 * Get webhook events
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const webhookId = searchParams.get("webhookId");
    const limit = parseInt(searchParams.get("limit") || "50");

    const events = await getWebhookEvents(
      webhookId ? parseInt(webhookId) : undefined,
      limit
    );

    return NextResponse.json({
      success: true,
      events,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Lỗi khi lấy webhook events",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

