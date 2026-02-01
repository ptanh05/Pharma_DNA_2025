import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { assignRole } from "@/lib/blockchain/contract";
import { parseSuiError, getSuiErrorHints } from "@/lib/blockchain/errors-sui";
import { Role } from "@/lib/blockchain/types-sui";

export const dynamic = 'force-dynamic';

const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

/**
 * POST /api/admin/sync-role
 * Retry syncing a role to blockchain
 * Body: { address: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address) {
      return NextResponse.json(
        { error: "Thiếu địa chỉ" },
        { status: 400 }
      );
    }

    if (!OWNER_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "OWNER_PRIVATE_KEY chưa được cấu hình" },
        { status: 500 }
      );
    }

    // Get role from database
    const { rows } = await pool.query(
      'SELECT role FROM users WHERE address = $1',
      [address.toLowerCase()]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy role trong database" },
        { status: 404 }
      );
    }

    const roleString = rows[0].role;
    
    // Convert role string to Role enum number
    let roleNumber: number;
    switch (roleString.toUpperCase()) {
      case 'MANUFACTURER':
        roleNumber = Role.MANUFACTURER;
        break;
      case 'DISTRIBUTOR':
        roleNumber = Role.DISTRIBUTOR;
        break;
      case 'PHARMACY':
        roleNumber = Role.PHARMACY;
        break;
      case 'ADMIN':
        roleNumber = Role.ADMIN;
        break;
      default:
        return NextResponse.json(
          { error: `Invalid role: ${roleString}` },
          { status: 400 }
        );
    }

    // Try to sync to blockchain
    console.log(`Retrying to sync role ${roleString} for address ${address}...`);
    const txResult = await assignRole(address, roleNumber, OWNER_PRIVATE_KEY);

    if (!txResult.success) {
      const blockchainError = parseSuiError(new Error(txResult.error || 'Transaction failed'));
      const hints = getSuiErrorHints(new Error(txResult.error || 'Transaction failed'));

      return NextResponse.json({
        success: false,
        error: "Đồng bộ blockchain thất bại",
        detail: blockchainError,
        hints: [
          "Kiểm tra OWNER_PRIVATE_KEY có ADMIN role trong contract",
          "Kiểm tra OWNER_PRIVATE_KEY có đủ SUI để trả gas",
          "Kiểm tra RPC endpoint Sui hoạt động",
          ...hints,
        ]
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      message: `✅ Đã đồng bộ quyền ${roleString} cho địa chỉ ${address} lên blockchain thành công!`,
      transactionHash: txResult.digest,
      transactionDigest: txResult.digest,
    });
  } catch (error: any) {
    console.error('Error in sync-role:', error);
    return NextResponse.json(
      { error: "Lỗi khi đồng bộ role", detail: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/sync-role
 * Get list of roles that need to be synced
 */
export async function GET(req: NextRequest) {
  try {
    // Get all users from database
    const { rows } = await pool.query(
      'SELECT address, role FROM users ORDER BY assigned_at DESC'
    );

    return NextResponse.json({
      success: true,
      users: rows,
      message: `Tìm thấy ${rows.length} users trong database`,
    });
  } catch (error: any) {
    console.error('Error getting users:', error);
    return NextResponse.json(
      { error: "Lỗi khi lấy danh sách users", detail: error.message },
      { status: 500 }
    );
  }
}

