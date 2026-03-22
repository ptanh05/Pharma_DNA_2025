/**
 * Manufacturer API - Create NFT
 * app/api/manufacturer/create/route.ts
 */

import { NextRequest } from "next/server";
import { manufacturerService } from "@/lib/services/manufacturer.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateRequestBody }from "@/lib/utils/api-validator";
import { z } from "zod";

const createNFTSchema = z.object({
  batchNumber: z.string().min(1, "Batch number is required"),
  name: z.string().min(1, "Drug name is required"),
  manufacturerAddress: z.string().min(1, "Manufacturer address is required"),
  ipfsHash: z.string().min(1, "IPFS hash is required"),
  expiryDate: z.string().min(1, "Expiry date is required"),
});

/**
 * POST /api/manufacturer/create
 * Create new NFT
 */
export async function POST(req: NextRequest) {
  try {
    const data = await validateRequestBody(req, createNFTSchema);

    const nft = await manufacturerService.createNFT(data);

    return createSuccessResponse({
      nft,
      message: "NFT created successfully",
    }, 201);
  }catch (error: any) {
    return createErrorResponse(error, "MANUFACTURER_CREATE_NFT");
  }
}

