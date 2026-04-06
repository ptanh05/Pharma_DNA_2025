/**
 * API Route: GET /api/distributor/transfer-to-pharmacy - Lấy danh sách transfer requests
 * API Route: POST /api/distributor/transfer-to-pharmacy - Tạo transfer mới
 *
 * Headers: Authorization: Bearer <JWT_TOKEN>
 * Body (POST): {
 *   nftId: number,
 *   pharmacyAddress: string
 * }
 */

import { NextRequest, NextResponse }from 'next/server';
import { authorizeRole, UnauthorizedError, ForbiddenError }from '@/lib/middleware/auth';
import { getTransactionManager }from '@/lib/db/transaction-manager';
import { transferProductNFT }from '@/lib/blockchain/contract';
import { pool } from "@/lib/db";
import { logInfo, logError, logBlockchain }from '@/lib/logger';
import { z }from 'zod';
import { v4 as uuidv4 }from 'uuid';
import { emitNFTTransferred, emitNotification } from '@/lib/socket/events';

const cancelTransferSchema = z.object({
  request_id: z.number().min(1, 'request_id là bắt buộc'),
});

// Validation schema
const transferSchema = z.object({
  nftId: z.number().min(1, 'nftId là bắt buộc'),
  pharmacyAddress: z.string().min(1, 'pharmacyAddress là bắt buộc'),
});

const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

/**
 * GET /api/distributor/transfer-to-pharmacy
 * Lấy danh sách transfers/pending NFTs từ nfts table
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pharmacy_address = searchParams.get("pharmacy_address");
    const status = searchParams.get("status");

    let query = `SELECT * FROM nfts WHERE pharmacy_address IS NOT NULL AND pharmacy_address != ''`;
    const params: any[] = [];
    let idx = 1;

    if (pharmacy_address) {
      query += ` AND pharmacy_address = $${idx}`;
      params.push(pharmacy_address.toLowerCase());
      idx++;
    }

    if (status) {
      query += ` AND status = $${idx}`;
      params.push(status);
      idx++;
    }

    query += ` ORDER BY updated_at DESC LIMIT 100`;

    const result = await pool.query(query, params);
    return NextResponse.json({ success: true, data: result.rows }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    // Bước 1: Xác thực user (DISTRIBUTOR)
    let user;
    try {
      user = await authorizeRole(req, 'DISTRIBUTOR');
    }catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          { error: 'Bạn phải đăng nhập để tiếp tục' },
          { status: 401 }
        );
      }
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          { error: 'Chỉ Distributor mới có thể transfer' },
          { status: 403 }
        );
      }
      throw error;
    }

    // Bước 2: Validate request
    const body = await req.json();
    const validatedData = transferSchema.parse(body);

    // Bước 3: Lấy NFT từ database
    const nftQuery = `
      SELECT id, batch_number, object_id, distributor_address, status
      FROM nfts
      WHERE id = $1
      LIMIT 1
    `;
    const nftResult = await pool.query(nftQuery, [validatedData.nftId]);

    if (!nftResult.rows.length) {
      return NextResponse.json(
        { error: 'NFT không tìm thấy' },
        { status: 404 }
      );
    }

    const nft = nftResult.rows[0];

    // Verify ownership
    if (nft.distributor_address !== user.address.toLowerCase()) {
      return NextResponse.json(
        { error: 'Bạn không sở hữu NFT này' },
        { status: 403 }
      );
    }

    // Verify status
    if (nft.status !== 'at_distributor') {
      return NextResponse.json(
        { error: 'Sản phẩm không ở trạng thái sẵn sàng để chuyển' },
        { status: 400 }
      );
    }

    // Bước 4: Tạo transfer transaction
    const idempotencyKey = `dist-transfer-${validatedData.nftId}-${Date.now()}`;
    const txManager = getTransactionManager();

    const result = await txManager.executeWithRecovery(
      async () => {
        // 4a: Transfer on blockchain
        logInfo('Transferring NFT to pharmacy', {
          requestId,
          nftId: validatedData.nftId,
          from: user.address,
          to: validatedData.pharmacyAddress,
        });

        // Use object_id for Sui blockchain transfer (fallback to batch_number if not set)
        const nftIdentifier = nft.object_id || nft.batch_number;
        const blockchainResult = await transferProductNFT(
          nftIdentifier,
          validatedData.pharmacyAddress,
          OWNER_PRIVATE_KEY!
        );

        if (!blockchainResult.success) {
          throw new Error(`Blockchain transfer failed: ${blockchainResult.error}`);
        }

        // 4b: Update database
        const now = new Date().toISOString();

        const updateQuery = `
          UPDATE nfts
          SET pharmacy_address = $1,
              status = 'at_pharmacy',
              updated_at = $2,
              transferred_at = $2
          WHERE id = $3
          RETURNING *
        `;

        const updateResult = await pool.query(updateQuery, [
          validatedData.pharmacyAddress.toLowerCase(),
          now,
          validatedData.nftId,
        ]);

        if (!updateResult.rows.length) {
          throw new Error('Failed to update NFT status');
        }

        logInfo('NFT transferred to pharmacy successfully', {
          requestId,
          nftId: validatedData.nftId,
          pharmacy: validatedData.pharmacyAddress,
        });

        return {
          nft: updateResult.rows[0],
          blockchain: blockchainResult,
        };
      },
      idempotencyKey
    );

    // Log blockchain event
    logBlockchain({
      requestId,
      action: 'TRANSFER_TO_PHARMACY',
      digest: result.blockchain.digest,
      status: 'success',
      duration: Date.now() - startTime,
    });

    // Emit real-time notifications
    try {
      emitNFTTransferred({
        objectId: result.nft.object_id || result.nft.batch_number,
        from: user.address,
        to: validatedData.pharmacyAddress,
        transactionDigest: result.blockchain.digest,
      });

      // Notify pharmacy
      emitNotification(validatedData.pharmacyAddress.toLowerCase(), {
        type: "success",
        title: "Nhận lô thuốc mới",
        message: `Lô thuốc #${result.nft.batch_number} đang chờ bạn xác nhận`,
        data: { nftId: result.nft.id, batchNumber: result.nft.batch_number },
      });

      // Notify distributor
      emitNotification(user.address.toLowerCase(), {
        type: "success",
        title: "Chuyển thuốc thành công",
        message: `Đã chuyển lô thuốc #${result.nft.batch_number} cho nhà thuốc`,
        data: { nftId: result.nft.id, batchNumber: result.nft.batch_number },
      });
    } catch (notifErr) {
      // Non-critical — don't fail the transfer if notification fails
      console.error("[SSE] Failed to emit transfer notifications:", notifErr);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'NFT đã được chuyển cho pharmacy thành công',
        data: {
          nft: result.nft,
          transactionDigest: result.blockchain.digest,
        },
      },
      { status: 200 }
    );

  }catch (error: any) {
    logError('Transfer endpoint error', error, { requestId });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Lỗi khi transfer NFT',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/distributor/transfer-to-pharmacy
 * Cancel/remove a pending transfer request
 */
export async function DELETE(req: NextRequest) {
  const requestId = uuidv4();

  try {
    // Step 1: Authenticate distributor
    let user;
    try {
      user = await authorizeRole(req, 'DISTRIBUTOR');
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          { error: 'Bạn phải đăng nhập để tiếp tục' },
          { status: 401 }
        );
      }
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          { error: 'Chỉ Distributor mới có thể hủy yêu cầu chuyển lô' },
          { status: 403 }
        );
      }
      throw error;
    }

    // Step 2: Parse and validate request
    const body = await req.json();
    const validatedData = cancelTransferSchema.parse(body);

    // Step 3: Check if distributor_address header matches authenticated user
    const headerDistributor = req.headers.get('x-distributor-address');
    if (headerDistributor && headerDistributor.toLowerCase() !== user.address.toLowerCase()) {
      return NextResponse.json(
        { error: 'Địa chỉ distributor không khớp với tài khoản đăng nhập' },
        { status: 403 }
      );
    }

    // Step 4: Find the transfer request in the database
    // Since we store transfers in the nfts table (pharmacy_address set = transfer record),
    // we find the NFT by ID and verify distributor ownership
    const nftQuery = `
      SELECT id, batch_number, object_id, distributor_address,
             pharmacy_address, status, updated_at
      FROM nfts
      WHERE id = $1
      LIMIT 1
    `;
    const nftResult = await pool.query(nftQuery, [validatedData.request_id]);

    if (!nftResult.rows.length) {
      return NextResponse.json(
        { error: 'Yêu cầu chuyển lô không tìm thấy' },
        { status: 404 }
      );
    }

    const nft = nftResult.rows[0];

    // Verify distributor owns this NFT
    if (nft.distributor_address !== user.address.toLowerCase()) {
      return NextResponse.json(
        { error: 'Bạn không sở hữu NFT này' },
        { status: 403 }
      );
    }

    // Only pending transfers can be cancelled
    // A pending transfer is when pharmacy_address is set but status is still 'at_pharmacy' pending pharmacy approval
    // or when it was a request that hasn't been fully executed yet
    if (nft.status !== 'at_pharmacy') {
      return NextResponse.json(
        { error: 'Chỉ có thể hủy các yêu cầu đang chờ (trạng thái at_pharmacy)' },
        { status: 400 }
      );
    }

    // Step 5: Cancel the transfer - revert NFT back to distributor's control
    const now = new Date().toISOString();
    const updateQuery = `
      UPDATE nfts
      SET pharmacy_address = NULL,
          status = 'at_distributor',
          updated_at = $1,
          transferred_at = NULL
      WHERE id = $2
      RETURNING *
    `;
    const updateResult = await pool.query(updateQuery, [now, validatedData.request_id]);

    if (!updateResult.rows.length) {
      return NextResponse.json(
        { error: 'Không thể hủy yêu cầu chuyển lô' },
        { status: 500 }
      );
    }

    // Emit real-time notifications for cancelled transfer
    try {
      emitNotification(user.address.toLowerCase(), {
        type: "warning",
        title: "Đã hủy yêu cầu chuyển lô",
        message: `Đã hủy chuyển lô thuốc #${nft.batch_number} cho nhà thuốc`,
        data: { nftId: validatedData.request_id, batchNumber: nft.batch_number },
      });

      if (nft.pharmacy_address) {
        emitNotification(nft.pharmacy_address, {
          type: "info",
          title: "Yêu cầu chuyển lô đã bị hủy",
          message: `Nhà phân phối đã hủy yêu cầu chuyển lô thuốc #${nft.batch_number}`,
          data: { nftId: validatedData.request_id, batchNumber: nft.batch_number },
        });
      }
    } catch (notifErr) {
      console.error("[SSE] Failed to emit cancel notifications:", notifErr);
    }

    logInfo('Transfer request cancelled', {
      requestId,
      nftId: validatedData.request_id,
      distributor: user.address,
      previousPharmacy: nft.pharmacy_address,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Đã hủy yêu cầu chuyển lô thành công',
        data: {
          nft: updateResult.rows[0],
        },
      },
      { status: 200 }
    );

  } catch (error: any) {
    logError('Cancel transfer endpoint error', error, { requestId });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Lỗi khi hủy yêu cầu chuyển lô',
      },
      { status: 500 }
    );
  }
}
