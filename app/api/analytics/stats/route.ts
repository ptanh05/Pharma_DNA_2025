import { NextRequest } from "next/server";
import { analyticsService } from "@/lib/services/analytics.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";

export async function GET() {
  try {
    const stats = await analyticsService.getNFTStats();
    return createSuccessResponse(stats);
  } catch (error: any) {
    return createErrorResponse(error, "ANALYTICS_STATS");
  }
}