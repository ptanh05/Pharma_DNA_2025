/**
 * API Route: POST /api/distributor/confirm-receipt
 * Confirm distributor receipt of an NFT from manufacturer
 *
 * No JWT required — ownership is verified from database record.
 * Body:
 *   - nftId: number (required)
 *   - distributorAddress: string (required, must match DB record)
 */

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { logInfo, logError } from "@/lib/logger";
import { logger } from '@/lib/utils/logger';
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { emitNotification } from "@/lib/socket/events";
import { ensureTableExists, TABLE_DEFINITIONS } from "@/lib/db/table-init";

const confirmReceiptSchema = z.object({
  nftId: z.number().min(1, "nftId là bắt buộc"),
  distributorAddress: z.string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Địa chỉ Sui không hợp lệ"),
});

/**
 * POST /api/distributor/confirm-receipt
 */
export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    // Bước 1: Validate request body
    const body = await req.json();
    const validatedData = confirmReceiptSchema.parse(body);
    const distributorAddress = validatedData.distributorAddress.toLowerCase();

    // Bước 2: Ensure tables exist
    await Promise.all([
      ensureTableExists("nfts", TABLE_DEFINITIONS.nfts),
    ]).catch(() => {});

    // Bước 3: Find the NFT and verify it belongs to this distributor
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
      distributorAddress,
    ]);

    if (!nftResult.rows.length) {
      return NextResponse.json(
        { success: false, error: "NFT không tìm thấy hoặc bạn không sở hữu NFT này" },
        { status: 404 }
      );
    }

    const nft = nftResult.rows[0];

    // Bước 4: Check if already confirmed (received)
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

    // Bước 5: Update NFT status to received/at_distributor
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
      distributor: distributorAddress,
      previousStatus: nft.status,
      newStatus: "received",
      duration: Date.now() - startTime,
    });

    // Record milestone for activity feed + chart
    try {
      await pool.query(
        `INSERT INTO milestones (nft_id, type, description, location, timestamp, actor_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          validatedData.nftId,
          'nhận hàng',
          `Đã nhận lô thuốc #${nft.batch_number} từ nhà sản xuất`,
          null,
          now,
          distributorAddress,
        ]
      );
    } catch (msErr) {
      logger.warn('API_DISTRIBUTOR', 'Failed to record milestone for confirm-receipt', msErr);
    }

    // Emit real-time notifications
    try {
      emitNotification(distributorAddress, {
        type: "success",
        title: "Đã nhận lô thuốc",
        message: `Đã xác nhận nhận lô thuốc #${nft.batch_number} từ nhà sản xuất`,
        data: { nftId: validatedData.nftId, batchNumber: nft.batch_number },
      });
    } catch (notifErr) {
      logger.error('API_DISTRIBUTOR', 'Failed to emit distributor receipt notification', notifErr);
    }

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
          error: error.errors[0]?.message || "Dữ liệu không hợp lệ",
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
