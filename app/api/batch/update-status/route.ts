/**
 * Batch Operations API - Update Status
 * app/api/batch/update-status/route.ts
 */

import { NextRequest }from "next/server";
import { batchService }from "@/lib/services/batch.service";
import { createSuccessResponse, createErrorResponse }from "@/lib/utils/api-response";
import { validateRequestBody }from "@/lib/utils/api-validator";
import { z } from "zod";

const batchUpdateSchema = z.object({
  nftIds: z.array(z.number().int().positive()).min(1),
  status: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { nftIds, status } = validateRequestBody(req, batchUpdateSchema);
    const results = await batchService.batchUpdateStatus(nftIds, status);

    return createSuccessResponse({
      updated: results.length,
      nfts: results,
    });
  } catch (error: any) {
    return createErrorResponse(error, "BATCH_UPDATE_STATUS");
  }
}
