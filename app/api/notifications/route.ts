/**
 * Notification API - Get Notifications
 * app/api/notifications/route.ts
 */

import { NextRequest } from "next/server";
import { notificationService } from "@/lib/services/notification.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateQueryParams }from "@/lib/utils/api-validator";
import { z }from "zod";

const notificationQuerySchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

/**
 * GET /api/notifications
 * Get user notifications
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { userId } = validateQueryParams(searchParams, notificationQuerySchema);

    const notifications = await notificationService.getUserNotifications(userId);

    return createSuccessResponse({
      notifications,
      count: notifications.length,
    });
  } catch (error: any) {
    return createErrorResponse(error, "NOTIFICATIONS_GET");
  }
}
