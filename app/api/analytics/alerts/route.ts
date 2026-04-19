import { NextRequest } from "next/server";
import { analyticsService } from "@/lib/services/analytics.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z } from "zod";

const alertsQuerySchema = z.object({
  days: z.enum(["7", "30", "90"]).default("30").transform(Number),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { days } = validateQueryParams(searchParams, alertsQuerySchema);

    const alerts = await analyticsService.getAlertsSummary(days);
    return createSuccessResponse({
      alerts,
      summary: {
        expiring: alerts.expiring.length,
        sensorAlerts: alerts.sensorAlerts.length,
        qualityAlerts: alerts.qualityAlerts.length,
        total: alerts.expiring.length + alerts.sensorAlerts.length + alerts.qualityAlerts.length,
      },
    });
  } catch (error: any) {
    return createErrorResponse(error, "ANALYTICS_ALERTS");
  }
}
