import { NextRequest } from "next/server";
import { analyticsService } from "@/lib/services/analytics.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";

export async function GET() {
  try {
    const alerts = await analyticsService.getExpiringAlerts();
    return createSuccessResponse({ alerts, total: alerts.length });
  } catch (error: any) {
    return createErrorResponse(error, "ANALYTICS_ALERTS");
  }
}
