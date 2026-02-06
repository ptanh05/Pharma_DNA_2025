import { NextRequest } from "next/server";
import { nftLookupService } from "@/lib/services/nft-lookup.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z } from "zod";

const verifyQuerySchema = z.object({
  nftId: z.string(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { nftId } = validateQueryParams(searchParams, verifyQuerySchema);

    const verification = await nftLookupService.verifyNFT(parseInt(nftId));

    return createSuccessResponse({
      ...verification,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return createErrorResponse(error, "PUBLIC_VERIFY");
  }
}
