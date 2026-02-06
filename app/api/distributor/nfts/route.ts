/**
 * Distributor API - Get NFTs
 * app/api/distributor/nfts/route.ts
 */

import { NextRequest }from "next/server";
import { distributorService } from "@/lib/services/distributor.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z }from "zod";

const nftsQuerySchema = z.object({
  address: z.string().min(1, "Address is required"),
  page: z.string().default("1").transform(Number),
  limit: z.string().default("10").transform(Number),
});

/**
 * GET /api/distributor/nfts
 * Get distributor NFTs
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { address, page, limit } = validateQueryParams(searchParams, nftsQuerySchema);

    const result = await distributorService.getDistributorNFTs(address, page, limit);

    return createSuccessResponse(result);
  } catch (error: any) {
    return createErrorResponse(error, "DISTRIBUTOR_GET_NFTS");
  }
}

