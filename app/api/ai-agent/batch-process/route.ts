import { NextRequest } from "next/server";
import { executeAgentTask } from "@/lib/ai-agent/core";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateRequestBody } from "@/lib/utils/api-validator";
import { z } from "zod";

// Request validation schema
const batchProcessSchema = z.object({
  action: z.enum(["batch_mint", "auto_transfer"]),
  data: z.array(z.any()).min(1, "Data array cannot be empty"),
  manufacturerAddress: z.string().min(1, "Manufacturer address is required"),
});

/**
 * POST /api/ai-agent/batch-process
 * Xử lý hàng loạt NFT
 */
export async function POST(req: NextRequest) {
  try {
    const { action, data, manufacturerAddress } = await validateRequestBody(
      req,
      batchProcessSchema
    );

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const results: any[] = [];
    const errors: any[] = [];

    if (action === "batch_mint") {
      for (const item of data) {
        try {
          const task = `Mint NFT cho lô thuốc:
- Tên: ${item.drugName}
- Số lô: ${item.batchNumber}
- IPFS Hash: ${item.ipfsHash}
- Manufacturer: ${manufacturerAddress}`;

          const result = await executeAgentTask(task, {
            nftData: item,
            manufacturerAddress,
          });

          results.push({
            batchNumber: item.batchNumber,
            success: true,
            result: result.output,
          });
        } catch (error: any) {
          errors.push({
            batchNumber: item.batchNumber,
            error: error.message,
          });
        }
      }
    } else if (action === "auto_transfer") {
      for (const item of data) {
        try {
          const task = `Chuyển NFT #${item.nftId}từ ${item.fromAddress} sang ${item.toAddress}`;

          const result = await executeAgentTask(task, {
            nftId: item.nftId,
            fromAddress: item.fromAddress,
            toAddress: item.toAddress,
          });

          results.push({
            nftId: item.nftId,
            success: true,
            result: result.output,
          });
        } catch (error: any) {
          errors.push({
            nftId: item.nftId,
            error: error.message,
          });
        }
      }
    }

    return createSuccessResponse({
      processed: results.length,
      errorCount: errors.length,
      results,
      errors,
    });
  } catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_BATCH_PROCESS");
  }
}
