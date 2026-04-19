/**
 * API Route: GET /api/analytics/funnel
 * Returns supply chain funnel data for SupplyChainFunnelChart component
 */

import { NextRequest } from "next/server";
import { analyticsService } from "@/lib/services/analytics.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const funnel = await analyticsService.getSupplyChainFunnel();
    return createSuccessResponse(funnel);
  } catch (error: any) {
    return createErrorResponse(error, "ANALYTICS_FUNNEL");
  }
}
