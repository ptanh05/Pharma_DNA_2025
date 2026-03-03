/**
 * Pharmacy API - Confirm Receipt
 * app/api/pharmacy/confirm-receipt/route.ts
 */

import { NextRequest } from "next/server";
import { pharmacyService } from "@/lib/services/pharmacy.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateRequestBody }from "@/lib/utils/api-validator";
import { z } from "zod";

const confirmReceiptSchema = z.object({
  nftId: z.number().int().positive("NFT ID must be positive"),
});

/**
 * POST /api/pharmacy/confirm-receipt
 * Confirm receipt of NFT
 */
export async function POST(req: NextRequest) {
  try {
    const { nftId } = validateRequestBody(req, confirmReceiptSchema);

    const nft = await pharmacyService.confirmReceipt(nftId);

    return createSuccessResponse({
      nft,
      message: "Receipt confirmed successfully",
    });
  }catch (error: any) {
    return createErrorResponse(error, "PHARMACY_CONFIRM_RECEIPT");
  }
}
