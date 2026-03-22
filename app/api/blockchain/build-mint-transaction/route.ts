/**
 * Blockchain Build Mint Transaction API
 * /api/blockchain/build-mint-transaction
 */

import { NextRequest } from "next/server";
import { createSuccessResponse, createErrorResponse }from "@/lib/utils/api-response";
import { validateRequestBody } from "@/lib/utils/api-validator";
import { sanitizeString }from "@/lib/validation/middleware";
import { logger }from "@/lib/utils/logger";
import { z }from "zod";

export const dynamic = "force-dynamic";

// Request validation schema
const buildMintTransactionSchema = z.object({
  ipfsHash: z.string().min(1, "IPFS hash is required"),
  batchNumber: z.string().min(1, "Batch number is required"),
  expiryDate: z.number().optional(),
  manufacturerAddress: z.string().min(1, "Manufacturer address is required"),
});

/**
 * POST /api/blockchain/build-mint-transaction
 * Build mint transaction for NFT
 */
export async function POST(req: NextRequest) {
  try {
    const { ipfsHash, batchNumber, expiryDate, manufacturerAddress } =
      await validateRequestBody(req, buildMintTransactionSchema);

    // Sanitize inputs
    const sanitizedHash = sanitizeString(ipfsHash);
    const sanitizedBatch = sanitizeString(batchNumber);

    // Build transaction
    const transaction = {
      type: "mint_nft",
      ipfsHash: sanitizedHash,
      batchNumber: sanitizedBatch,
      expiryDate: expiryDate || Date.now() + 365 * 24 * 60 * 60 * 1000,
      manufacturerAddress,
      timestamp: Date.now(),
    };

    logger.info("blockchain:build-mint", "Transaction built", transaction);

    return createSuccessResponse({
      transaction,
      message: "Transaction built successfully",
    });
  }catch (error: any) {
    logger.error("blockchain:build-mint", "Failed to build transaction", error);
    return createErrorResponse(error, "BLOCKCHAIN_BUILD_MINT");
  }
}
