/**
 * API Route: POST /api/distributor/confirm-receipt
 * Confirm distributor receipt of an NFT from manufacturer
 *
 * Body:
 *   - nftId: number (required)
 *   - distributorAddress: string (required)
 */

import { NextRequest, NextResponse } from "next/server";
import { authorizeRole, UnauthorizedError, ForbiddenError } from "@/lib/middleware/auth";
import { pool } from "@/lib/db";
import { logInfo, logError } from "@/lib/logger";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const confirmReceiptSchema = z.object({
  nftId: z.number().min(1, "nftId là bắt buộc"),
  distributorAddress: z.string().min(1, "distributorAddress là bắt buộc"),
});

/**
 * POST /api/distributor/confirm-receipt
 */
export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    // Step 1: Authenticate distributor
    let user;
    try {
      user = await authorizeRole(req, "DISTRIBUTOR");
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          { success: false, error: "Bạn phải đăng nhập để tiếp tục" },
          { status: 401 }
        );
      }
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          { success: false, error: "Chỉ Distributor mới có thể xác nhận nhận hàng" },
          { status: 403 }
        );
      }
      throw error;
    }

    // Step 2: Validate request body
    const body = await req.json();
    const validatedData = confirmReceiptSchema.parse(body);

    // Step 3: Verify the distributor address matches authenticated user
    if (validatedData.distributorAddress.toLowerCase() !== user.address.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "Địa chỉ distributor không khớp với tài khoản đăng nhập" },
        { status: 403 }
      );
    }

    // Step 4: Find the NFT and verify ownership/transfer status
    const nftQuery = `
      SELECT id, batch_number, name, object_id, status,
             manufacturer_address, distributor_address,
             transferred_at, created_at
      FROM nfts
      WHERE id = $1
        AND distributor_address = $2
      LIMIT 1
    `;
    const nftResult = await pool.query(nftQuery, [
      validatedData.nftId,
      validatedData.distributorAddress.toLowerCase(),
    ]);

    if (!nftResult.rows.length) {
      return NextResponse.json(
        { success: false, error: "NFT không tìm thấy hoặc bạn không sở hữu NFT này" },
        { status: 404 }
      );
    }

    const nft = nftResult.rows[0];

    // Step 5: Check if already confirmed (received)
    if (nft.status === "received" || nft.status === "at_distributor") {
      return NextResponse.json(
        { success: false, error: "NFT này đã được xác nhận nhận trước đó" },
        { status: 400 }
      );
    }

    // Only confirm if NFT is in a transferable/transit state
    if (nft.status !== "in_transit" && nft.status !== "pending_receipt") {
      return NextResponse.json(
        { success: false, error: `Không thể xác nhận nhận NFT ở trạng thái "${nft.status}"` },
        { status: 400 }
      );
    }

    // Step 6: Update NFT status to received/at_distributor
    const now = new Date().toISOString();
    const updateQuery = `
      UPDATE nfts
      SET status = 'received',
          updated_at = $1,
          received_at = $1
      WHERE id = $2
      RETURNING *
    `;
    const updateResult = await pool.query(updateQuery, [now, validatedData.nftId]);

    if (!updateResult.rows.length) {
      return NextResponse.json(
        { success: false, error: "Không thể cập nhật trạng thái NFT" },
        { status: 500 }
      );
    }

    logInfo("Distributor confirmed receipt of NFT", {
      requestId,
      nftId: validatedData.nftId,
      distributor: validatedData.distributorAddress,
      previousStatus: nft.status,
      newStatus: "received",
      duration: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Đã xác nhận nhận lô thuốc thành công",
        data: {
          nft: updateResult.rows[0],
        },
      },
      { status: 200 }
    );

  } catch (error: any) {
    logError("Confirm receipt endpoint error", error, { requestId });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Dữ liệu không hợp lệ",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Lỗi khi xác nhận nhận hàng",
      },
      { status: 500 }
    );
  }
}
