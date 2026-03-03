/**
 * Notification API - Create
 * app/api/notifications/create/route.ts
 */

import { NextRequest } from "next/server";
import { notificationService }from "@/lib/services/notification.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateRequestBody } from "@/lib/utils/api-validator";
import { z } from "zod";

const createNotificationSchema = z.object({
  userId: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
});

/**
 * POST /api/notifications/create
 * Create notification
 */
export async function POST(req: NextRequest) {
  try {
    const data = validateRequestBody(req, createNotificationSchema);
    const notification = await notificationService.createNotification(data);

    return createSuccessResponse(notification, 201);
  } catch (error: any) {
    return createErrorResponse(error, "NOTIFICATION_CREATE");
  }
}
