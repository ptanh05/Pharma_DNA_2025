/**
 * Export API
 * app/api/export/nfts/route.ts
 */

import { NextRequest } from "next/server";
import { exportService } from "@/lib/services/export.service";
import { createSuccessResponse, createErrorResponse }from "@/lib/utils/api-response";

/**
 * GET /api/export/nfts
 * Export NFTs
 */
export async function GET(req: NextRequest) {
  try {
    const nfts = await exportService.exportNFTs();
    return createSuccessResponse({
      count: nfts.length,
      nfts,
    });
  } catch (error: any) {
    return createErrorResponse(error, "EXPORT_NFTS");
  }
}

