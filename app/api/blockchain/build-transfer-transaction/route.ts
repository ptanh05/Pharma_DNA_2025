/**
 * Blockchain Build Transfer Transaction API
 * /api/blockchain/build-transfer-transaction
 */

import { NextRequest } from "next/server";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateRequestBody }from "@/lib/utils/api-validator";
import { sanitizeAddress } from "@/lib/validation/middleware";
import { logger } from "@/lib/utils/logger";
import { z }from "zod";

export const dynamic = "force-dynamic";

// Request validation schema
const buildTransferTransactionSchema = z.object({
  nftId: z.number().int().positive("NFT ID must be positive"),
  toAddress: z.string().min(1, "To address is required"),
  fromAddress: z.string().min(1, "From address is required"),
});

/**
 * POST /api/blockchain/build-transfer-transaction
 * Build transfer transaction for NFT
 */
export async function POST(req: NextRequest) {
  try {
    const { nftId, toAddress, fromAddress } = await validateRequestBody(
      req,
      buildTransferTransactionSchema
    );

    const sanitizedTo = sanitizeAddress(toAddress);
    const sanitizedFrom = sanitizeAddress(fromAddress);

    const transaction = {
      type: "transfer_nft",
      nftId,
      fromAddress: sanitizedFrom,
      toAddress: sanitizedTo,
      timestamp: Date.now(),
    };

    logger.info("blockchain:build-transfer", "Transaction built", transaction);

    return createSuccessResponse({
      transaction,
      message: "Transaction built successfully",
    });
  }catch (error: any) {
    logger.error("blockchain:build-transfer", "Failed to build transaction", error);
    return createErrorResponse(error, "BLOCKCHAIN_BUILD_TRANSFER_TRANSACTION");
  }
}
