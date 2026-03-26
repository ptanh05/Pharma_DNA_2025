/**
 * API Route: GET /api/admin/stats
 * Lấy thống kê cho admin dashboard
 *
 * Headers: Authorization: Bearer <JWT_TOKEN>
 * Query:
 *   - period: 'today' | 'week' | 'month' | 'all'
 */

import { NextRequest, NextResponse }from 'next/server';
import { verifyAdminToken }from '@/lib/middleware/admin-auth';
import { pool } from "@/lib/db";
import { logInfo, logError }from '@/lib/logger';
import { v4 as uuidv4 }from 'uuid';

export async function GET(req: NextRequest) {
  const requestId = uuidv4();

  try {
    // Bước 1: Xác thực admin
    const adminToken = verifyAdminToken(req);
    if (!adminToken) {
      return NextResponse.json(
        { error: 'Bạn phải đăng nhập để tiếp tục' },
        { status: 401 }
      );
    }

    // Bước 2: Lấy period parameter
    const { searchParams }= new URL(req.url);
    const period = searchParams.get('period') || 'week';

    // Xác định date range
    let dateFilter = '';
    switch (period) {
      case 'today':
        dateFilter = `AND created_at::date = CURRENT_DATE`;
        break;
      case 'week':
        dateFilter = `AND created_at >= CURRENT_DATE - INTERVAL '7 days'`;
        break;
      case 'month':
        dateFilter = `AND created_at >= CURRENT_DATE - INTERVAL '30 days'`;
        break;
      default:
        dateFilter = '';
    }

    // Bước 3: Lấy NFT statistics
    const nftStatsQuery = `
      SELECT
        COUNT(*) as total_nfts,
        COUNT(CASE WHEN status = 'minted' THEN 1 END) as minted,
        COUNT(CASE WHEN status = 'at_distributor' THEN 1 END) as at_distributor,
        COUNT(CASE WHEN status = 'at_pharmacy' THEN 1 END) as at_pharmacy,
        COUNT(CASE WHEN status = 'dispensed' THEN 1 END) as dispensed,
        COUNT(DISTINCT manufacturer_address) as unique_manufacturers,
        COUNT(DISTINCT distributor_address) as unique_distributors,
        COUNT(DISTINCT pharmacy_address) as unique_pharmacies
      FROM nfts
      WHERE 1=1 ${dateFilter}
    `;

    // Bước 4: Lấy user statistics
    const userStatsQuery = `
      SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'MANUFACTURER' THEN 1 END) as manufacturers,
        COUNT(CASE WHEN role = 'DISTRIBUTOR' THEN 1 END) as distributors,
        COUNT(CASE WHEN role = 'PHARMACY' THEN 1 END) as pharmacies,
        COUNT(CASE WHEN role = 'CONSUMER' THEN 1 END) as consumers,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_users_week
      FROM users
    `;

    // Bước 5: Lấy dispensing statistics
    const dispensingQuery = `
      SELECT
        COUNT(*) as total_dispensed,
        COALESCE(SUM(quantity), 0) as total_quantity_dispensed,
        COUNT(DISTINCT nft_id) as unique_products_dispensed,
        COUNT(DISTINCT pharmacy_address) as pharmacies_dispensing
      FROM dispensing_records
      WHERE 1=1 ${dateFilter}
    `;

    // Bước 6: Lấy recent transactions
    const recentQuery = `
      SELECT
        id,
        batch_number,
        status,
        created_at,
        updated_at,
        manufacturer_address,
        distributor_address,
        pharmacy_address
      FROM nfts
      ORDER BY updated_at DESC
      LIMIT 10
    `;

    // Execute all queries in parallel for better performance
    const [nftStats, userStats, dispensingStats, recentTransactions] = await Promise.all([
      pool.query(nftStatsQuery),
      pool.query(userStatsQuery),
      pool.query(dispensingQuery),
      pool.query(recentQuery)
    ]);

    logInfo('Admin dashboard stats retrieved', {
      requestId,
      period,
      nftCount: nftStats.rows[0]?.total_nfts || 0,
      userCount: userStats.rows[0]?.total_users || 0,
      dispensedCount: dispensingStats.rows[0]?.total_dispensed || 0,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          period,
          nft: nftStats.rows[0],
          users: userStats.rows[0],
          dispensing: dispensingStats.rows[0],
          recentTransactions: recentTransactions.rows,
        },
      },
      { status: 200 }
    );

  }catch (error: any) {
    logError('Dashboard stats endpoint error', error, { requestId });

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Lỗi khi lấy dashboard stats',
      },
      { status: 500 }
    );
  }
}
