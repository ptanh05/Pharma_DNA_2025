import { NextRequest } from "next/server";
import {
  createWebhook,
  getWebhooks,
  updateWebhook,
  deleteWebhook,
} from "@/lib/ai-agent/webhooks";
import { createSuccessResponse, createErrorResponse }from "@/lib/utils/api-response";
import { validateRequestBody, validateQueryParams } from "@/lib/utils/api-validator";
import { z }from "zod";

// Query validation schema
const webhooksQuerySchema = z.object({
  enabled: z.string().default("false").transform(v => v === "true"),
});

// POST request validation schema
const createWebhookSchema = z.object({
  url: z.string().url("Invalid webhook URL"),
  events: z.array(z.string()).min(1, "At least one event is required"),
  active: z.boolean().default(true),
});

// PUT request validation schema
const updateWebhookSchema = z.object({
  id: z.string().min(1, "Webhook ID is required"),
  url: z.string().url("Invalid webhook URL").optional(),
  events: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

// DELETE request validation schema
const deleteWebhookSchema = z.object({
  id: z.string().min(1, "Webhook ID is required"),
});

/**
 * GET /api/ai-agent/webhooks
 * Get all webhooks
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { enabled } = validateQueryParams(searchParams, webhooksQuerySchema);

    const webhooks = await getWebhooks(enabled);

    return createSuccessResponse({ webhooks });
  } catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_WEBHOOKS_GET");
  }
}

/**
 * POST /api/ai-agent/webhooks
 * Create webhook
 */
export async function POST(req: NextRequest) {
  try {
    const { url, events, active } = await validateRequestBody(
      req,
      createWebhookSchema
    );

    const webhook = await createWebhook(url, events, active);

    return createSuccessResponse({ webhook }, 201);
  } catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_WEBHOOKS_POST");
  }
}

/**
 * PUT /api/ai-agent/webhooks
 * Update webhook
 */
export async function PUT(req: NextRequest) {
  try {
    const { id, url, events, active } = await validateRequestBody(
      req,
      updateWebhookSchema
    );

    const webhook = await updateWebhook(id, { url, events, active });

    return createSuccessResponse({ webhook });
  }catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_WEBHOOKS_PUT");
  }
}

/**
 * DELETE /api/ai-agent/webhooks
 * Delete webhook
 */
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await validateRequestBody(req, deleteWebhookSchema);

    await deleteWebhook(id);

    return createSuccessResponse({ message: "Webhook deleted successfully" });
  }catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_WEBHOOKS_DELETE");
  }
}
