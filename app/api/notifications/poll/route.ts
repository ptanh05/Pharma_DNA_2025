import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { z } from 'zod';

// FIXED: Force dynamic rendering to prevent SSG/prerender
export const dynamic = 'force-dynamic';

const pollQuerySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Địa chỉ Sui không hợp lệ"),
  role: z.enum(['MANUFACTURER', 'DISTRIBUTOR', 'PHARMACY', 'CONSUMER', 'ADMIN']).optional(),
  lastCheck: z.string().optional(),
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
    const rawAddress = searchParams.get('address');
    const rawRole = searchParams.get('role');
    const rawLastCheck = searchParams.get('lastCheck');

    // Validate query params
    const validatedData = pollQuerySchema.parse({
      address: rawAddress,
      role: rawRole,
      lastCheck: rawLastCheck,
    });

    const lastCheckDate = validatedData.lastCheck
      ? new Date(validatedData.lastCheck)
      : new Date(Date.now() - 60000); // Default: 1 minute ago

    const notifications: any[] = [];

    // Note: transfer_requests table is created via migration script
    // See: database/create_transfer_requests_table.sql

    // Check for new transfer requests (if user is pharmacy)
    if (validatedData.role === 'PHARMACY') {
      try {
        const transferRequests = await pool.query(
          `SELECT * FROM transfer_requests
           WHERE pharmacy_address = $1
           AND status = 'pending'
           AND created_at > $2
           ORDER BY created_at DESC`,
          [validatedData.address.toLowerCase(), lastCheckDate.toISOString()]
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
      } catch (error: any) {
        console.error('Error querying transfer requests for pharmacy:', error);
        // Continue without failing
      }
    }

    // Check for approved transfer requests (if user is distributor)
    if (validatedData.role === 'DISTRIBUTOR') {
      try {
        const approvedRequests = await pool.query(
          `SELECT * FROM transfer_requests
           WHERE distributor_address = $1
           AND status = 'approved'
           AND updated_at > $2
           ORDER BY updated_at DESC`,
          [validatedData.address.toLowerCase(), lastCheckDate.toISOString()]
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
      } catch (error: any) {
        console.error('Error querying approved requests for distributor:', error);
        // Continue without failing
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

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to poll notifications', detail: error.message },
      { status: 500 }
    );
  }
}

