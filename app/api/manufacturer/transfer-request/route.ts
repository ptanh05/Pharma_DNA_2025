/**
 * API Routes for manufacturer transfer requests:
 * - GET  /api/manufacturer/transfer-request - List transfer requests (JWT required)
 * - POST /api/manufacturer/transfer-request - Create new transfer (JWT required)
 * - PUT  /api/manufacturer/transfer-request - Approve distributor request (no JWT, DB verification)
 *
 * PUT body: { requestId, nftId, distributorAddress, manufacturerAddress }
 * POST body: { nftId, recipientAddress, recipientRole }
 */

import { NextRequest, NextResponse }from 'next/server';
import { authorizeRole, UnauthorizedError, ForbiddenError } from '@/lib/middleware/auth';
import { getTransactionManager }from '@/lib/db/transaction-manager';
import { transferProductNFT }from '@/lib/blockchain/contract';
import { pool } from "@/lib/db";
import { logInfo, logError, logBlockchain }from '@/lib/logger';
import { z }from 'zod';
import { v4 as uuidv4 }from 'uuid';

// Validation schema
const transferRequestSchema = z.object({
  nftId: z.number().min(1, 'nftId là bắt buộc'),
  recipientAddress: z.string().min(1, 'recipientAddress là bắt buộc'),
  recipientRole: z.enum(['DISTRIBUTOR', 'PHARMACY']),
});

const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

/**
 * PUT /api/manufacturer/transfer-request
 * Manufacturer duyệt (approve) yêu cầu nhận lô từ distributor
 *
 * No JWT required — ownership is verified from database record.
 * Body: {
 *   requestId: number,
 *   nftId: number,
 *   distributorAddress: string,
 *   manufacturerAddress: string
 * }
 */
export async function PUT(req: NextRequest) {
  const requestId = uuidv4();

  try {
    // Validate body
    const body = await req.json();
    const { requestId: reqId, nftId, distributorAddress, manufacturerAddress } = body;

    if (!reqId || !nftId || !distributorAddress || !manufacturerAddress) {
      return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
    }

    const mfgAddress = manufacturerAddress.toLowerCase();
    const distAddress = distributorAddress.toLowerCase();

    // Verify NFT ownership from DB
    const nftResult = await pool.query(
      `SELECT id, object_id, batch_number, status, manufacturer_address
       FROM nfts WHERE id = $1 LIMIT 1`,
      [nftId]
    );

    if (!nftResult.rows.length) {
      return NextResponse.json({ error: 'NFT không tìm thấy' }, { status: 404 });
    }

    const nft = nftResult.rows[0];
    if (nft.manufacturer_address !== mfgAddress) {
      return NextResponse.json({ error: 'Bạn không sở hữu NFT này' }, { status: 403 });
    }

    // Execute blockchain transfer + DB update
    const nftIdentifier = nft.object_id || nft.batch_number;
    if (!OWNER_PRIVATE_KEY) {
      return NextResponse.json({ error: 'OWNER_PRIVATE_KEY chưa được cấu hình' }, { status: 500 });
    }

    const blockchainResult = await transferProductNFT(nftIdentifier, distAddress, OWNER_PRIVATE_KEY);
    if (!blockchainResult.success) {
      return NextResponse.json({ error: `Transfer blockchain thất bại: ${blockchainResult.error}` }, { status: 500 });
    }

    const now = new Date().toISOString();
    const updateResult = await pool.query(
      `UPDATE nfts SET distributor_address = $1, status = 'at_distributor', updated_at = $2 WHERE id = $3 RETURNING *`,
      [distAddress, now, nftId]
    );

    // Update transfer request status to approved
    await pool.query(
      `UPDATE transfer_requests SET status = 'approved', updated_at = $1 WHERE id = $2`,
      [now, reqId]
    );

    logInfo('Transfer approved by manufacturer', {
      requestId, nftId, manufacturer: mfgAddress, distributor: distAddress, digest: blockchainResult.digest
    });

    return NextResponse.json({
      success: true,
      message: 'Đã duyệt và chuyển lô thành công',
      data: {
        nft: updateResult.rows[0],
        transactionDigest: blockchainResult.digest,
      }
    }, { status: 200 });

  } catch (error: any) {
    logError('PUT transfer-request error', error, { requestId });
    return NextResponse.json({ error: error.message || 'Lỗi khi duyệt transfer' }, { status: 500 });
  }
}

/**
 * GET /api/manufacturer/transfer-request
 * Lấy danh sách transfer requests cho manufacturer hiện tại
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const distributor = searchParams.get("distributor");

    // Get manufacturer address from auth
    let user;
    try {
      user = await authorizeRole(req, 'MANUFACTURER');
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json({ error: 'Bạn phải đăng nhập để tiếp tục' }, { status: 401 });
      }
      if (error instanceof ForbiddenError) {
        return NextResponse.json({ error: 'Chỉ Manufacturer mới có quyền xem' }, { status: 403 });
      }
      throw error;
    }

    // Primary query: transfer_requests table (distributor → pharmacy flow)
    let query = `
      SELECT id, nft_id, distributor_address, pharmacy_address, transfer_note, status, created_at, updated_at
      FROM transfer_requests
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    // Filter by distributor if provided
    if (distributor) {
      query += ` AND distributor_address = $${idx}`;
      params.push(distributor.toLowerCase());
      idx++;
    }

    // Also include NFTs owned by this manufacturer that are pending transfer to distributors
    // (these are NFT records where the manufacturer initiated but no transfer_request exists yet)
    query += ` ORDER BY created_at DESC LIMIT 100`;

    let result;
    try {
      result = await pool.query(query, params);
    } catch (tableError: any) {
      // If transfer_requests table doesn't exist, fall back to NFTs table
      if (tableError.message?.includes('does not exist')) {
        const fallbackQuery = `
          SELECT
            id,
            id as nft_id,
            NULL::integer as distributor_address,
            distributor_address,
            NULL::text as pharmacy_address,
            pharmacy_address,
            NULL::text as transfer_note,
            status,
            created_at,
            updated_at
          FROM nfts
          WHERE manufacturer_address = $1
            AND status IN ('minted', 'ready_for_transfer')
          ORDER BY created_at DESC
          LIMIT 100
        `;
        result = await pool.query(fallbackQuery, [user.address.toLowerCase()]);
      } else {
        throw tableError;
      }
    }

    return NextResponse.json({ success: true, data: result.rows }, { status: 200 });
  } catch (error: any) {
    console.error('[GET transfer-request] Error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi khi lấy transfer requests' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    // Bước 1: Xác thực user (MANUFACTURER)
    let user;
    try {
      user = await authorizeRole(req, 'MANUFACTURER');
    }catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          { error: 'Bạn phải đăng nhập để tiếp tục' },
          { status: 401 }
        );
      }
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          { error: 'Chỉ Manufacturer mới có thể transfer' },
          { status: 403 }
        );
      }
      throw error;
    }

    // Bước 2: Validate request
    const body = await req.json();
    const validatedData = transferRequestSchema.parse(body);

    // Bước 3: Lấy NFT từ database
    const nftQuery = `
      SELECT id, batch_number, object_id, manufacturer_address, status
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
    if (nft.manufacturer_address !== user.address.toLowerCase()) {
      return NextResponse.json(
        { error: 'Bạn không sở hữu NFT này' },
        { status: 403 }
      );
    }

    // Bước 4: Tạo transfer transaction
    const idempotencyKey = `transfer-${validatedData.nftId}-${Date.now()}`;
    const txManager = getTransactionManager();

    const result = await txManager.executeWithRecovery(
      async () => {
        // 4a: Transfer on blockchain
        logInfo('Transferring NFT on blockchain', {
          requestId,
          nftId: validatedData.nftId,
          from: user.address,
          to: validatedData.recipientAddress,
        });

        // Use object_id for Sui blockchain transfer (fallback to batch_number if not set)
        const nftIdentifier = nft.object_id || nft.batch_number;
        if (!OWNER_PRIVATE_KEY) {
          throw new Error("OWNER_PRIVATE_KEY environment variable is not configured");
        }
        const blockchainResult = await transferProductNFT(
          nftIdentifier,
          validatedData.recipientAddress,
          OWNER_PRIVATE_KEY
        );

        if (!blockchainResult.success) {
          throw new Error(`Blockchain transfer failed: ${blockchainResult.error}`);
        }

        // 4b: Update database
        const now = new Date().toISOString();
        const columnName = validatedData.recipientRole === 'DISTRIBUTOR'
          ? 'distributor_address'
          : 'pharmacy_address';

        const updateQuery = `
          UPDATE nfts
          SET ${columnName} = $1,
              status = $2,
              updated_at = $3
          WHERE id = $4
          RETURNING *
        `;

        const newStatus = validatedData.recipientRole === 'DISTRIBUTOR'
          ? 'at_distributor'
          : 'at_pharmacy';

        const updateResult = await pool.query(updateQuery, [
          validatedData.recipientAddress.toLowerCase(),
          newStatus,
          now,
          validatedData.nftId,
        ]);

        if (!updateResult.rows.length) {
          throw new Error('Failed to update NFT status');
        }

        logInfo('NFT transferred successfully', {
          requestId,
          nftId: validatedData.nftId,
          status: newStatus,
          recipient: validatedData.recipientAddress,
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
      action: `TRANSFER_TO_${validatedData.recipientRole}`,
      digest: result.blockchain.digest,
      status: 'success',
      duration: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        success: true,
        message: `NFT đã được chuyển cho ${validatedData.recipientRole}`,
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
