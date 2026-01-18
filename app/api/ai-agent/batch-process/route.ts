import { NextRequest, NextResponse } from "next/server";
import { executeAgentTask } from "@/lib/ai-agent/core";
import { pool } from "@/lib/db";

/**
 * POST /api/ai-agent/batch-process
 * Xử lý hàng loạt NFT (ví dụ: mint nhiều NFT từ file Excel)
 */
export async function POST(req: NextRequest) {
  try {
    const { action, data, manufacturerAddress } = await req.json();

    if (!action || !data || !manufacturerAddress) {
      return NextResponse.json(
        { error: "Thiếu thông tin bắt buộc" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY chưa được cấu hình" },
        { status: 500 }
      );
    }

    const results: any[] = [];
    const errors: any[] = [];

    if (action === "batch_mint") {
      // Batch mint NFTs
      for (const item of data) {
        try {
          const task = `Mint NFT cho lô thuốc:
- Tên: ${item.drugName}
- Số lô: ${item.batchNumber}
- IPFS Hash: ${item.ipfsHash}
- Manufacturer: ${manufacturerAddress}

Hãy mint NFT và tạo database record.`;

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
      // Tự động chuyển NFT cho distributor
      for (const item of data) {
        try {
          const task = `Chuyển NFT #${item.nftId} từ ${item.fromAddress} sang ${item.toAddress}.
Sau đó tạo milestone "Đã chuyển giao" và gửi thông báo cho cả hai bên.`;

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

    return NextResponse.json({
      success: true,
      processed: results.length,
      errorCount: errors.length,
      results,
      errors,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Lỗi khi xử lý hàng loạt",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

