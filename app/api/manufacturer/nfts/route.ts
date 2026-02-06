/**
 * Manufacturer API - Get NFTs
 * app/api/manufacturer/nfts/route.ts
 */

import { NextRequest } from "next/server";
import { manufacturerService } from "@/lib/services/manufacturer.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z }from "zod";

const nftsQuerySchema = z.object({
  address: z.string().min(1, "Address is required"),
  page: z.string().default("1").transform(Number),
  limit: z.string().default("10").transform(Number),
});

/**
 * GET /api/manufacturer/nfts
 * Get manufacturer NFTs
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { address, page, limit }= validateQueryParams(searchParams, nftsQuerySchema);

    const result = await manufacturerService.getManufacturerNFTs(address, page, limit);

    return createSuccessResponse(result);
  } catch (error: any) {
    return createErrorResponse(error, "MANUFACTURER_GET_NFTS");
  }
}

