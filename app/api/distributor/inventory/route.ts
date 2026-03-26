/**
 * API Route: GET /api/distributor/inventory
 * Lấy danh sách sản phẩm mà distributor đã nhận
 *
 * Headers: Authorization: Bearer <JWT_TOKEN>
 * Query:
 *   - status: 'all' | 'available' | 'transferred'
 *   - page: number (default: 1)
 *   - limit: number (default: 20)
 */

import { NextRequest, NextResponse }from 'next/server';
import { authorizeRole, UnauthorizedError, ForbiddenError }from '@/lib/middleware/auth';
import { pool } from "@/lib/db";
import { logInfo, logError }from '@/lib/logger';
import { v4 as uuidv4 }from 'uuid';

export async function GET(req: NextRequest) {
  const requestId = uuidv4();

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
          { error: 'Chỉ Distributor mới có thể xem inventory' },
          { status: 403 }
        );
      }
      throw error;
    }

    // Bước 2: Lấy query parameters
    const { searchParams }= new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    // Bước 3: Build query with window function for total count
    let query = `
      SELECT
        id,
        name,
        batch_number,
        status,
        manufacturer_address,
        distributor_address,
        pharmacy_address,
        created_at,
        updated_at,
        COUNT(*) OVER() as total_count
      FROM nfts
      WHERE distributor_address = $1
    `;

    const params: any[] = [user.address.toLowerCase()];

    // Filter by status
    if (status === 'available') {
      query += ` AND status IN ('at_distributor')`;
    } else if (status === 'transferred') {
      query += ` AND status IN ('at_pharmacy', 'dispensed')`;
    }

    // Add pagination
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    // Bước 4: Execute query
    const result = await pool.query(query, params);

    // Get total count from window function
    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count || '0', 10) : 0;

    logInfo('Distributor inventory retrieved', {
      requestId,
      userId: user.userId,
      itemCount: result.rows.length,
      totalCount,
      page,
      limit,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          inventory: result.rows,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit),
          },
        },
      },
      { status: 200 }
    );

  }catch (error: any) {
    logError('Inventory endpoint error', error, { requestId });

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Lỗi khi lấy inventory',
      },
      { status: 500 }
    );
  }
}
