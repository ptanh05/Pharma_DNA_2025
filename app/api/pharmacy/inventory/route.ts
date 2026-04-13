/**
 * API Route: GET /api/pharmacy/inventory
 * Lấy danh sách sản phẩm hiện có tại hiệu thuốc
 *
 * Headers: Authorization: Bearer <JWT_TOKEN>
 * Query:
 *   - status: 'all' | 'available' | 'dispensed'
 *   - page: number (default: 1)
 *   - limit: number (default: 20)
 */

import { NextRequest, NextResponse }from 'next/server';
import { authorizeRole } from '@/lib/middleware/auth';
import { pool } from "@/lib/db";
import { logInfo, logError }from '@/lib/logger';
import { v4 as uuidv4 }from 'uuid';

export async function GET(req: NextRequest) {
  const requestId = uuidv4();

  try {
    // Bước 1: Lấy pharmacy address từ query param (no JWT required)
    const { searchParams } = new URL(req.url);
    const pharmacyAddress = searchParams.get('address');

    // Fallback: try to get from JWT (optional)
    let userAddress: string | null = null;
    try {
      userAddress = await authorizeRole(req, 'PHARMACY').then(u => u.address).catch(() => null);
    } catch {}

    const address = pharmacyAddress || userAddress;

    if (!address) {
      return NextResponse.json(
        { error: 'Thiếu pharmacy_address. Vui lòng đăng nhập hoặc cung cấp pharmacy_address trong query.' },
        { status: 400 }
      );
    }

    const addr = address.toLowerCase();

    // Bước 2: Lấy query parameters
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
        quantity,
        manufacturer_address,
        distributor_address,
        pharmacy_address,
        created_at,
        updated_at,
        receipt_confirmed_at,
        last_dispensed_at,
        COUNT(*) OVER() as total_count
      FROM nfts
      WHERE pharmacy_address = $1
    `;

    const params: any[] = [addr];

    // Filter by status
    if (status === 'available') {
      query += ` AND status = 'at_pharmacy' AND (quantity IS NULL OR quantity > 0)`;
    } else if (status === 'dispensed') {
      query += ` AND status = 'dispensed'`;
    }

    // Add pagination
    query += ` ORDER BY updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    // Bước 4: Execute query
    const result = await pool.query(query, params);

    // Get total count from window function
    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count || '0', 10) : 0;

    // Lấy statistics
    const statsQuery = `
      SELECT
        COUNT(*) as total_products,
        COALESCE(SUM(quantity), 0) as total_quantity,
        COUNT(CASE WHEN status = 'at_pharmacy' THEN 1 END) as available,
        COUNT(CASE WHEN status = 'dispensed' THEN 1 END) as dispensed
      FROM nfts
      WHERE pharmacy_address = $1
    `;

    const statsResult = await pool.query(statsQuery, [addr]);
    const stats = statsResult.rows[0];

    logInfo('Pharmacy inventory retrieved', {
      requestId,
      userId: addr,
      itemCount: result.rows.length,
      totalCount,
      page,
      limit,
      stats: {
        total: stats.total_products,
        quantity: stats.total_quantity,
        available: stats.available,
        dispensed: stats.dispensed,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          inventory: result.rows,
          statistics: {
            totalProducts: parseInt(stats.total_products, 10),
            totalQuantity: parseInt(stats.total_quantity, 10),
            available: parseInt(stats.available, 10),
            dispensed: parseInt(stats.dispensed, 10),
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
