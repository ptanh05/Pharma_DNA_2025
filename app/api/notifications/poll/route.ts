import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// FIXED: Force dynamic rendering to prevent SSG/prerender
export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * GET /api/notifications/poll
 * Polling endpoint for real-time updates
 * 
 * Query params:
 * - address: User wallet address
 * - role: User role
 * - lastCheck: Timestamp of last check (ISO string)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address')?.toLowerCase();
    const role = searchParams.get('role');
    const lastCheck = searchParams.get('lastCheck');

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    const lastCheckDate = lastCheck ? new Date(lastCheck) : new Date(Date.now() - 60000); // Default: 1 minute ago

    const notifications: any[] = [];

    // Check for new transfer requests (if user is pharmacy)
    if (role === 'PHARMACY') {
      const transferRequests = await pool.query(
        `SELECT * FROM transfer_requests 
         WHERE pharmacy_address = $1 
         AND status = 'pending'
         AND created_at > $2
         ORDER BY created_at DESC`,
        [address, lastCheckDate.toISOString()]
      );

      for (const request of transferRequests.rows) {
        notifications.push({
          type: 'transfer-request:created',
          id: `transfer-${request.id}`,
          title: 'Yêu cầu chuyển lô mới',
          message: `Nhà phân phối muốn chuyển NFT #${request.nft_id} đến bạn`,
          data: request,
          timestamp: request.created_at,
        });
      }
    }

    // Check for approved transfer requests (if user is distributor)
    if (role === 'DISTRIBUTOR') {
      const approvedRequests = await pool.query(
        `SELECT * FROM transfer_requests 
         WHERE distributor_address = $1 
         AND status = 'approved'
         AND updated_at > $2
         ORDER BY updated_at DESC`,
        [address, lastCheckDate.toISOString()]
      );

      for (const request of approvedRequests.rows) {
        notifications.push({
          type: 'transfer-request:approved',
          id: `transfer-approved-${request.id}`,
          title: 'Yêu cầu đã được duyệt',
          message: `Nhà thuốc đã duyệt yêu cầu chuyển NFT #${request.nft_id}. Bạn có thể ký transaction để chuyển.`,
          data: request,
          timestamp: request.updated_at,
        });
      }
    }

    // Check for new milestones (for all roles tracking specific NFTs)
    // This would require tracking which NFTs users are watching
    // For now, we'll skip this or implement a simpler version

    return NextResponse.json({
      success: true,
      notifications,
      count: notifications.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Poll notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to poll notifications', detail: error.message },
      { status: 500 }
    );
  }
}

