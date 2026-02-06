import { NextRequest } from "next/server";
import { nftLookupService } from "@/lib/services/nft-lookup.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z } from "zod";

const productQuerySchema = z.object({
  nftId: z.string(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { nftId } = validateQueryParams(searchParams, productQuerySchema);

    const result = await nftLookupService.getNFTWithChain(parseInt(nftId));

    if (!result) {
      return createSuccessResponse({
        found: false,
        message: "Product not found",
      });
    }

    return createSuccessResponse({
      found: true,
      nft: result.nft,
      milestones: result.milestones,
    });
  } catch (error: any) {
    return createErrorResponse(error, "PUBLIC_PRODUCT");
  }
}