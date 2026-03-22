/**
 * Pharmacy API - Mark Available
 * app/api/pharmacy/mark-available/route.ts
 */

import { NextRequest } from "next/server";
import { pharmacyService }from "@/lib/services/pharmacy.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateRequestBody } from "@/lib/utils/api-validator";
import { z }from "zod";

const markAvailableSchema = z.object({
  nftId: z.number().int().positive("NFT ID must be positive"),
});

/**
 * POST /api/pharmacy/mark-available
 * Mark NFT as available for sale
 */
export async function POST(req: NextRequest) {
  try {
    const { nftId } = await validateRequestBody(req, markAvailableSchema);

    const nft = await pharmacyService.markAvailable(nftId);

    return createSuccessResponse({
      nft,
      message: "NFT marked as available",
    });
  } catch (error: any) {
    return createErrorResponse(error, "PHARMACY_MARK_AVAILABLE");
  }
}

