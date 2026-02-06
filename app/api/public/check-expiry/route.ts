import { NextRequest } from "next/server";
import { nftLookupService } from "@/lib/services/nft-lookup.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z } from "zod";

const expiryQuerySchema = z.object({
  nftId: z.string(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { nftId } = validateQueryParams(searchParams, expiryQuerySchema);

    const expiryInfo = await nftLookupService.checkExpiry(parseInt(nftId));

    return createSuccessResponse({
      ...expiryInfo,
      status: expiryInfo.expired ? "EXPIRED" : "VALID",
    });
  } catch (error: any) {
    return createErrorResponse(error, "PUBLIC_EXPIRY");
  }
}