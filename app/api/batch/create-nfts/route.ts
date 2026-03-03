/**
 * Batch Operations API
 * app/api/batch/create-nfts/route.ts
 */

import { NextRequest } from "next/server";
import { batchService } from "@/lib/services/batch.service";
import { createSuccessResponse, createErrorResponse }from "@/lib/utils/api-response";
import { validateRequestBody } from "@/lib/utils/api-validator";
import { z } from "zod";

const batchCreateSchema = z.object({
  nfts: z.array(z.object({
    batchNumber: z.string(),
    name: z.string(),
    manufacturerAddress: z.string(),
    ipfsHash: z.string(),
    expiryDate: z.string(),
  })),
});

export async function POST(req: NextRequest) {
  try {
    const { nfts }= validateRequestBody(req, batchCreateSchema);
    const results = await batchService.batchCreateNFTs(nfts);

    return createSuccessResponse({
      created: results.length,
      nfts: results,
    }, 201);
  }catch (error: any) {
    return createErrorResponse(error, "BATCH_CREATE_NFTS");
  }
}
