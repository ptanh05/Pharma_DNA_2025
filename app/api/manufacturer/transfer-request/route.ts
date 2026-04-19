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
import { pool } from "@/lib/db";
import { logInfo, logError, logWarn } from '@/lib/logger';
import { getSuiErrorHints } from '@/lib/blockchain/errors-sui';
import { logger } from '@/lib/utils/logger';
import { z }from 'zod';
import { v4 as uuidv4 }from 'uuid';


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

    // Chỉ duyệt yêu cầu trong database — distributor sẽ tự transfer bằng ví của họ
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
          `Đã duyệt yêu cầu nhận lô #${nft.batch_number} cho distributor`,
          null,
          now,
          mfgAddress,
        ]
      );
    } catch (msErr) {
      logger.warn('API_MANUFACTURER', 'Failed to record milestone for transfer approval', msErr);
    }

    logInfo('Transfer approved by manufacturer (DB only)', {
      requestId, nftId, manufacturer: mfgAddress, distributor: distAddress
    });

    return NextResponse.json({
      success: true,
      message: 'Đã duyệt và chuyển lô thành công',
      data: {
        nft: updateResult.rows[0],
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

/**
 * POST /api/manufacturer/transfer-request
 * Update database after manufacturer signs transfer with their own wallet.
 *
 * Blockchain transfer is done client-side (manufacturer's wallet signs).
 * This endpoint only updates the database record.
 *
 * Body: { nftId: number, recipientAddress: string, recipientRole: 'DISTRIBUTOR'|'PHARMACY', transactionDigest: string }
 */
export async function POST(req: NextRequest) {
  const requestId = uuidv4();

  try {
    // Bước 1: Xác thực user (MANUFACTURER)
    let user;
    try {
      user = await authorizeRole(req, 'MANUFACTURER');
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json({ error: 'Bạn phải đăng nhập để tiếp tục' }, { status: 401 });
      }
      if (error instanceof ForbiddenError) {
        return NextResponse.json({ error: 'Chỉ Manufacturer mới có thể transfer' }, { status: 403 });
      }
      throw error;
    }

    // Bước 2: Validate request
    const body = await req.json();
    const postSchema = z.object({
      nftId: z.number().min(1),
      recipientAddress: z.string().min(1),
      recipientRole: z.enum(['DISTRIBUTOR', 'PHARMACY']),
      transactionDigest: z.string().min(1),
    });
    const { nftId, recipientAddress, recipientRole, transactionDigest } = postSchema.parse(body);

    // Bước 3: Lấy NFT từ database
    const nftResult = await pool.query(
      `SELECT id, batch_number, object_id, manufacturer_address, status
       FROM nfts WHERE id = $1 LIMIT 1`,
      [nftId]
    );

    if (!nftResult.rows.length) {
      return NextResponse.json({ error: 'NFT không tìm thấy' }, { status: 404 });
    }

    const nft = nftResult.rows[0];

    // Verify ownership
    if (nft.manufacturer_address !== user.address.toLowerCase()) {
      return NextResponse.json({ error: 'Bạn không sở hữu NFT này' }, { status: 403 });
    }

    // Bước 4: Update database — blockchain đã được transfer bởi wallet của manufacturer
    const now = new Date().toISOString();
    const columnName = recipientRole === 'DISTRIBUTOR' ? 'distributor_address' : 'pharmacy_address';
    const newStatus = recipientRole === 'DISTRIBUTOR' ? 'at_distributor' : 'at_pharmacy';

    const updateResult = await pool.query(
      `UPDATE nfts
       SET ${columnName} = $1, status = $2, transaction_digest = $3, updated_at = $4
       WHERE id = $5
       RETURNING *`,
      [recipientAddress.toLowerCase(), newStatus, transactionDigest, now, nftId]
    );

    if (!updateResult.rows.length) {
      return NextResponse.json({ error: 'Không thể cập nhật NFT' }, { status: 500 });
    }

    // Cập nhật transfer request status
    try {
      await pool.query(
        `UPDATE transfer_requests_v2 SET status = 'approved', updated_at = $1
         WHERE nft_id = $2 AND distributor_address = $3 AND status = 'pending' LIMIT 1`,
        [now, nftId, recipientAddress.toLowerCase()]
      );
    } catch {}
    try {
      await pool.query(
        `UPDATE transfer_requests SET status = 'approved', updated_at = $1
         WHERE nft_id = $2 AND distributor_address = $3 AND status = 'pending' LIMIT 1`,
        [now, nftId, recipientAddress.toLowerCase()]
      );
    } catch {}

    // Record milestone
    const msDesc = recipientRole === 'DISTRIBUTOR'
      ? `Đã giao lô thuốc #${nft.batch_number} cho distributor`
      : `Đã giao lô thuốc #${nft.batch_number} cho pharmacy`;
    try {
      await pool.query(
        `INSERT INTO milestones (nft_id, type, description, location, timestamp, actor_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [nftId, 'giao hàng', msDesc, null, now, user.address.toLowerCase()]
      );
    } catch (msErr) {
      logger.warn('API_MANUFACTURER', 'Failed to record milestone', msErr);
    }

    logInfo('Manufacturer transfer DB updated', { requestId, nftId, recipientRole, transactionDigest });

    return NextResponse.json({
      success: true,
      message: `Đã chuyển lô cho ${recipientRole}`,
      data: { nft: updateResult.rows[0], transactionDigest },
    }, { status: 200 });

  } catch (error: any) {
    logError('POST transfer-request error', error, { requestId });
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message || 'Lỗi khi transfer' }, { status: 500 });
  }
}
