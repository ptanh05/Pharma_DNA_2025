import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { assignRole, getRole } from "@/lib/blockchain/contract";
import { parseSuiError } from "@/lib/blockchain/errors-sui";
import { Role } from "@/lib/blockchain/types-sui";
import { logger } from "@/lib/utils/logger";

export const dynamic = 'force-dynamic';

const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

/**
 * POST /api/admin/sync-all-pending
 * Sync all roles from database to blockchain that are not yet synced
 */
export async function POST(req: NextRequest) {
  try {
    if (!OWNER_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "OWNER_PRIVATE_KEY chưa được cấu hình" },
        { status: 500 }
      );
    }

    // Get all users from database
    const { rows } = await pool.query(
      'SELECT address, role FROM users ORDER BY assigned_at DESC'
    );

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const user of rows) {
      const address = user.address;
      const roleString = user.role;

      try {
        // Check if role is already synced on blockchain
        const blockchainRole = await getRole(address);
        const roleNumber = getRoleNumber(roleString);
        
        if (blockchainRole === roleNumber) {
          results.push({
            address,
            role: roleString,
            status: 'already_synced',
            message: 'Đã được đồng bộ trên blockchain',
          });
          continue;
        }

        // Try to sync
        logger.info('SYNC_ALL_PENDING', `Syncing role ${roleString} for address ${address}...`);
        const txResult = await assignRole(address, roleNumber, OWNER_PRIVATE_KEY);

        if (txResult.success) {
          successCount++;
          results.push({
            address,
            role: roleString,
            status: 'success',
            transactionDigest: txResult.digest,
            message: 'Đồng bộ thành công',
          });
        } else {
          failCount++;
          results.push({
            address,
            role: roleString,
            status: 'failed',
            error: parseSuiError(new Error(txResult.error || 'Transaction failed')),
            message: 'Đồng bộ thất bại',
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        failCount++;
        results.push({
          address,
          role: roleString,
          status: 'error',
          error: error.message,
          message: 'Lỗi khi xử lý',
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: rows.length,
      successCount,
      failCount,
      alreadySynced: rows.length - successCount - failCount,
      results,
      message: `Đã xử lý ${rows.length} users: ${successCount} thành công, ${failCount} thất bại`,
    });
  } catch (error: any) {
    logger.error('SYNC_ALL_PENDING', 'Error in sync-all-pending', error);
    return NextResponse.json(
      { error: "Lỗi khi đồng bộ tất cả roles", detail: error.message },
      { status: 500 }
    );
  }
}

function getRoleNumber(roleString: string): Role {
  switch (roleString.toUpperCase()) {
    case 'MANUFACTURER':
      return Role.MANUFACTURER;
    case 'DISTRIBUTOR':
      return Role.DISTRIBUTOR;
    case 'PHARMACY':
      return Role.PHARMACY;
    case 'ADMIN':
      return Role.ADMIN;
    default:
      return Role.NONE;
  }
}

