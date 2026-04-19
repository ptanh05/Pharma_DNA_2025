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
import { transferProductNFT } from '@/lib/blockchain/contract';
import { getSuiErrorHints, isRetryableError } from '@/lib/blockchain/errors-sui';
import { pool } from "@/lib/db";
import { logInfo, logError, logWarn, logBlockchain }from '@/lib/logger';
import { logger } from '@/lib/utils/logger';
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

    if (!nftIdentifier || nftIdentifier.trim() === '') {
      return NextResponse.json({
        error: 'NFT không có object_id hoặc batch_number trong database. Kiểm tra dữ liệu NFT.',
      }, { status: 400 });
    }

    // Retry logic for RPC/network errors (up to 2 retries)
    let blockchainResult: Awaited<ReturnType<typeof transferProductNFT>> | null = null;
    let lastError = '';
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        blockchainResult = await transferProductNFT(nftIdentifier, distAddress, OWNER_PRIVATE_KEY);
        break; // success or business error — stop retrying
      } catch (rpcError: any) {
        lastError = rpcError?.message || String(rpcError);
        logWarn(`PUT transfer-request RPC error (attempt ${attempt})`, { nftId, requestId, error: rpcError?.message });

        // Only retry on transient RPC/network errors
        if (attempt <= maxRetries && isRetryableError(rpcError)) {
          // Wait 500ms before retry
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        // Non-retryable or exhausted retries — surface the error
        const hints = getSuiErrorHints(rpcError);
        return NextResponse.json({
          error: `Lỗi kết nối Sui RPC: ${lastError}`,
          hints,
        }, { status: 500 });
      }
    }

    if (!blockchainResult) {
      return NextResponse.json({ error: 'Lỗi không xác định khi transfer' }, { status: 500 });
    }

    if (!blockchainResult.success) {
      const errorMsg = blockchainResult.error || 'Lỗi không xác định';
      const hints = getSuiErrorHints({ message: errorMsg });
      return NextResponse.json({
        error: `Transfer blockchain thất bại: ${errorMsg}`,
        hints,
      }, { status: 500 });
    }

    const now = new Date().toISOString();
    const updateResult = await pool.query(
      `UPDATE nfts SET distributor_address = $1, status = 'at_distributor', updated_at = $2 WHERE id = $3 RETURNING *`,
      [distAddress, now, nftId]
    );

    // Update transfer request status to approved (both tables for compatibility)
    try {
      await pool.query(
        `UPDATE transfer_requests SET status = 'approved', updated_at = $1 WHERE id = $2`,
        [now, reqId]
      );
    } catch {}
    try {
      await pool.query(
        `UPDATE transfer_requests_v2 SET status = 'approved', updated_at = $1 WHERE id = $2`,
        [now, reqId]
      );
    } catch {}

    // Record milestone for activity feed + chart
    try {
      await pool.query(
        `INSERT INTO milestones (nft_id, type, description, location, timestamp, actor_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          nftId,
          'giao hàng',
          `Đã giao lô thuốc #${nft.batch_number} cho distributor`,
          null,
          now,
          mfgAddress,
        ]
      );
    } catch (msErr) {
      logger.warn('API_MANUFACTURER', 'Failed to record milestone for transfer approval', msErr);
    }

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
 *
 * Sử dụng manufacturer_address query param thay vì JWT auth (RoleGuard đã kiểm tra ở frontend)
 *
 * Query params:
 * - manufacturer_address: Địa chỉ manufacturer (0x...)
 * - distributor: Lọc theo distributor (tùy chọn)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const distributor = searchParams.get("distributor");
    const manufacturerAddress = searchParams.get("manufacturer_address");

    // Validate manufacturer address if provided
    if (manufacturerAddress) {
      const addressRegex = /^0x[a-fA-F0-9]{64}$/;
      if (!addressRegex.test(manufacturerAddress)) {
        return NextResponse.json({ error: 'Địa chỉ manufacturer không hợp lệ' }, { status: 400 });
      }
    }

    // Primary query: transfer_requests_v2 (distributor sends request here)
    let query = `
      SELECT trv.id, trv.nft_id, trv.distributor_address, trv.pharmacy_address,
             trv.transfer_note, trv.status, trv.created_at, trv.updated_at
      FROM transfer_requests_v2 trv
      INNER JOIN nfts n ON n.id = trv.nft_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    // Filter by manufacturer (only show requests for NFTs this manufacturer owns)
    if (manufacturerAddress) {
      query += ` AND n.manufacturer_address = $${idx}`;
      params.push(manufacturerAddress.toLowerCase());
      idx++;
    }

    // Filter by distributor if provided
    if (distributor) {
      query += ` AND trv.distributor_address = $${idx}`;
      params.push(distributor.toLowerCase());
      idx++;
    }

    query += ` ORDER BY trv.created_at DESC LIMIT 100`;

    let result;
    try {
      result = await pool.query(query, params);
    } catch (tableError: any) {
      // If transfer_requests_v2 doesn't exist, fall back to original transfer_requests
      const errMsg = tableError.message || '';
      const isMissingTable =
        errMsg.includes('does not exist') ||
        errMsg.includes('relation') ||
        errMsg.includes('column') ||
        errMsg.includes('invalid reference');

      if (isMissingTable) {
        logWarn('[GET transfer-request] transfer_requests_v2 unavailable, falling back', tableError);
        let fallbackQuery = `
          SELECT
            tr.id,
            tr.nft_id,
            tr.distributor_address,
            tr.pharmacy_address,
            tr.transfer_note,
            tr.status,
            tr.created_at,
            tr.updated_at
          FROM transfer_requests tr
          INNER JOIN nfts n ON n.id = tr.nft_id
          WHERE 1=1
        `;
        const fallbackParams: any[] = [];
        let fallbackIdx = 1;

        if (manufacturerAddress) {
          fallbackQuery += ` AND n.manufacturer_address = $${fallbackIdx}`;
          fallbackParams.push(manufacturerAddress.toLowerCase());
          fallbackIdx++;
        }

        if (distributor) {
          fallbackQuery += ` AND tr.distributor_address = $${fallbackIdx}`;
          fallbackParams.push(distributor.toLowerCase());
          fallbackIdx++;
        }

        fallbackQuery += ` ORDER BY tr.created_at DESC LIMIT 100`;

        try {
          result = await pool.query(fallbackQuery, fallbackParams);
        } catch (fallbackError: any) {
          // Both tables missing — return empty gracefully
          logWarn('[GET transfer-request] Both transfer_requests tables unavailable', fallbackError);
          return NextResponse.json({ success: true, data: [] }, { status: 200 });
        }
      } else {
        throw tableError;
      }
    }

    return NextResponse.json({ success: true, data: result.rows }, { status: 200 });
  } catch (error: any) {
    logger.error('API_MANUFACTURER', 'GET transfer-request error', error);
    const hints = getSuiErrorHints(error);
    return NextResponse.json({
      error: error.message || 'Lỗi khi lấy transfer requests',
      hints,
    }, { status: 500 });
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
          const errorMsg = blockchainResult.error || 'Lỗi không xác định';
          const hints = getSuiErrorHints({ message: errorMsg });
          throw Object.assign(new Error(`Blockchain transfer failed: ${errorMsg}`), { hints });
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
          confirmedAt: now,
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

    // Record milestone for activity feed + chart
    const msDesc = validatedData.recipientRole === 'DISTRIBUTOR'
      ? `Đã giao lô thuốc #${result.nft.batch_number} cho distributor`
      : `Đã giao lô thuốc #${result.nft.batch_number} cho pharmacy`;
    try {
      await pool.query(
        `INSERT INTO milestones (nft_id, type, description, location, timestamp, actor_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [validatedData.nftId, 'giao hàng', msDesc, null, result.confirmedAt, user.address.toLowerCase()]
      );
    } catch (msErr) {
      logger.warn('API_MANUFACTURER', 'Failed to record milestone', msErr);
    }

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

  } catch (error: any) {
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

    // Return hints if available (attached by blockchain validation above)
    const hints = Array.isArray(error.hints) ? error.hints : getSuiErrorHints(error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Lỗi khi transfer NFT',
        hints,
      },
      { status: 500 }
    );
  }
}
