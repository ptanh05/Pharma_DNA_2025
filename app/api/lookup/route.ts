/**
 * Lookup API - Search NFT
 * app/api/lookup/route.ts
 */

import { NextRequest }from "next/server";
import { nftLookupService } from "@/lib/services/nft-lookup.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z } from "zod";

const lookupQuerySchema = z.object({
  batch: z.string().optional(),
  id: z.string().optional().transform(v => v ? parseInt(v) : undefined),
  verify: z.string().default("false").transform(v => v === "true"),
  chain: z.string().default("false").transform(v => v === "true"),
});

/**
 * GET /api/lookup
 * Search for NFT by batch number or ID
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { batch, id, verify, chain } = validateQueryParams(searchParams, lookupQuerySchema);

    if (!batch && !id) {
      throw new Error("Either batch or id parameter is required");
    }

    let result;

    if (batch) {
      result = await nftLookupService.searchByBatchNumber(batch);
    }else if (id) {
      if (chain) {
        result = await nftLookupService.getNFTWithChain(id);
      } else {
        result = await nftLookupService.verifyNFT(id);
      }
    }

    if (!result) {
      return createErrorResponse(
        new Error("NFT not found"),
        "LOOKUP_NOT_FOUND"
      );
    }

    // Check expiry if requested
    if (verify && id) {
      const expiry = await nftLookupService.checkExpiry(id);
      result = { ...result, expiry };
    }

    return createSuccessResponse(result);
  }catch (error: any) {
    return createErrorResponse(error, "LOOKUP_SEARCH");
  }
}
