/**
 * API Route: GET /api/admin/stats
 * Lấy thống kê cho admin dashboard
 *
 * Headers: Authorization: Bearer <JWT_TOKEN>
 * Query:
 *   - period: 'today' | 'week' | 'month' | 'all'
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/middleware/admin-auth';
import { pool } from "@/lib/db";
import { logInfo, logError } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import { ensureTableExists, TABLE_DEFINITIONS } from "@/lib/db/table-init";

export async function GET(req: NextRequest) {
  const requestId = uuidv4();

  try {
    // Bước 1: Ensure tables exist first (prevents 504 on cold start)
    await Promise.all([
      ensureTableExists("nfts", TABLE_DEFINITIONS.nfts),
      ensureTableExists("users", TABLE_DEFINITIONS.users),
    ]).catch(() => { /* Tables may already exist */ });

    // Bước 2: Xác thực admin (middleware already allowed this request through)
    const adminUser = await verifyAdminToken(req);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Bạn phải đăng nhập để tiếp tục' },
        { status: 401 }
      );
    }

    // Bước 3: Lấy period parameter
    const { searchParams } = new URL(req.url);
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

    // Bước 4: Lấy NFT statistics + user statistics in parallel
    const [nftStats, userStats] = await Promise.all([
      pool.query(`
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
      `),
      pool.query(`
        SELECT
          COUNT(*) as total_users,
          COUNT(CASE WHEN role = 'MANUFACTURER' THEN 1 END) as manufacturers,
          COUNT(CASE WHEN role = 'DISTRIBUTOR' THEN 1 END) as distributors,
          COUNT(CASE WHEN role = 'PHARMACY' THEN 1 END) as pharmacies,
          COUNT(CASE WHEN role = 'ADMIN' THEN 1 END) as admins,
          COUNT(CASE WHEN role = 'CONSUMER' THEN 1 END) as consumers,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_users_week
        FROM users
      `),
    ]);

    // Bước 5: Lấy recent transactions (with timeout protection)
    let recentTransactions: any[] = [];
    try {
      const recentResult = await Promise.race([
        pool.query(`
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
        `),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 5000)),
      ]);
      recentTransactions = (recentResult as any).rows || [];
    } catch {
      recentTransactions = [];
    }

    logInfo('Admin dashboard stats retrieved', {
      requestId,
      period,
      nftCount: nftStats.rows[0]?.total_nfts || 0,
      userCount: userStats.rows[0]?.total_users || 0,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          period,
          nft: nftStats.rows[0] || {},
          users: userStats.rows[0] || {},
          dispensing: { total_dispensed: 0, total_quantity_dispensed: 0, unique_products_dispensed: 0, pharmacies_dispensing: 0 },
          recentTransactions,
        },
      },
      { status: 200 }
    );

  } catch (error: any) {
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
