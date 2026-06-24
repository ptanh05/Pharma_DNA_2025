/**
 * API Route: GET /api/pharmacy/inventory
 * Lấy danh sách sản phẩm hiện có tại hiệu thuốc
 *
 * Query:
 *   - address: pharmacy wallet address (required)
 *   - status: 'all' | 'available' | 'dispensed'
 *   - page: number (default: 1)
 *   - limit: number (default: 20)
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { logInfo, logError } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { searchParams } = new URL(req.url);
    const pharmacyAddress = searchParams.get('address');

    if (!pharmacyAddress) {
      return NextResponse.json(
        { success: false, error: 'Thiếu address. Cung cấp wallet address trong query param.' },
        { status: 400 }
      );
    }

    const addr = pharmacyAddress.toLowerCase();
    const status = searchParams.get('status') || 'all';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    // Count total matching records
    let countQuery = `SELECT COUNT(*) as total_count FROM nfts WHERE LOWER(pharmacy_address) = LOWER($1)`;
    const countParams: (string | number)[] = [addr];

    if (status === 'available') {
      countQuery += ` AND status = 'at_pharmacy' AND (quantity IS NULL OR quantity > 0)`;
    } else if (status === 'dispensed') {
      countQuery += ` AND status = 'dispensed'`;
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = Number(countResult.rows[0]?.total_count ?? 0);

    // Fetch inventory records
    let query = `
      SELECT
        id, name, batch_number, status, quantity,
        manufacturer_address, distributor_address, pharmacy_address,
        created_at, updated_at
      FROM nfts
      WHERE LOWER(pharmacy_address) = LOWER($1)
    `;
    const params: (string | number)[] = [addr];

    if (status === 'available') {
      query += ` AND status = 'at_pharmacy' AND (quantity IS NULL OR quantity > 0)`;
    } else if (status === 'dispensed') {
      query += ` AND status = 'dispensed'`;
    }

    query += ` ORDER BY updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Statistics
    const statsResult = await pool.query(
      `SELECT
        COUNT(*) as total_products,
        COALESCE(SUM(COALESCE(quantity, 0)), 0) as total_quantity,
        COUNT(CASE WHEN status = 'at_pharmacy' THEN 1 END) as available,
        COUNT(CASE WHEN status = 'dispensed' THEN 1 END) as dispensed
       FROM nfts
       WHERE LOWER(pharmacy_address) = LOWER($1)`,
      [addr]
    );

    const stats = statsResult.rows[0];

    logInfo('Pharmacy inventory retrieved', {
      requestId,
      userId: addr,
      itemCount: result.rows.length,
      totalCount,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          inventory: result.rows,
          statistics: {
            totalProducts: Number(stats.total_products ?? 0),
            totalQuantity: Number(stats.total_quantity ?? 0),
            available: Number(stats.available ?? 0),
            dispensed: Number(stats.dispensed ?? 0),
          },
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
  } catch (error: any) {
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
