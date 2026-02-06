import { NextRequest } from "next/server";
import { nftLookupService } from "@/lib/services/nft-lookup.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z } from "zod";

const lookupQuerySchema = z.object({
  batch: z.string().optional(),
  nftId: z.string().optional(),
  qr: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { batch, nftId, qr } = validateQueryParams(searchParams, lookupQuerySchema);

    const parsedNftId = nftId ? parseInt(nftId) : undefined;

    let result;
    let searchType = "";

    if (batch) {
      result = await nftLookupService.searchByBatchNumber(batch);
      searchType = "batch";
    } else if (parsedNftId) {
      result = await nftLookupService.getNFTWithChain(parsedNftId);
      searchType = "id";
    } else if (qr) {
      result = await nftLookupService.searchByBatchNumber(qr);
      searchType = "qr";
    }

    if (!result && (batch || nftId || qr)) {
      return createSuccessResponse({
        found: false,
        message: "NFT not found",
      });
    }

    return createSuccessResponse({
      found: true,
      type: searchType,
      result,
    });
  } catch (error: any) {
    return createErrorResponse(error, "PUBLIC_LOOKUP");
  }
}