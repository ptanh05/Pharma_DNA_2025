/**
 * Distributor API - Transfer to Pharmacy
 * app/api/distributor/transfer-to-pharmacy/route.ts
 */

import { NextRequest } from "next/server";
import { distributorService } from "@/lib/services/distributor.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateRequestBody }from "@/lib/utils/api-validator";
import { z }from "zod";

const transferSchema = z.object({
  nftId: z.number().int().positive("NFT ID must be positive"),
  pharmacyAddress: z.string().min(1, "Pharmacy address is required"),
});

/**
 * POST /api/distributor/transfer-to-pharmacy
 * Transfer NFT to pharmacy
 */
export async function POST(req: NextRequest) {
  try {
    const { nftId, pharmacyAddress }= await validateRequestBody(req, transferSchema);

    const nft = await distributorService.transferToPharmacy(nftId, pharmacyAddress);

    return createSuccessResponse({
      nft,
      message: "NFT transferred to pharmacy successfully",
    });
  }catch (error: any) {
    return createErrorResponse(error, "DISTRIBUTOR_TRANSFER");
  }
}
