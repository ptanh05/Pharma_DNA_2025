import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { assignRole } from "@/lib/blockchain/contract";
import { parseSuiError, getSuiErrorHints } from "@/lib/blockchain/errors-sui";
import { Role } from "@/lib/blockchain/types-sui";
import { ensureTableExists, TABLE_DEFINITIONS } from "@/lib/db/table-init";

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/sync-role
 * Sync role từ database lên blockchain contract.
 * Không yêu cầu JWT — dùng OWNER_PRIVATE_KEY để sign transaction.
 * Manufacturer có thể gọi trực tiếp khi cần.
 *
 * Body: { address: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address) {
      return NextResponse.json({ error: "Thiếu địa chỉ" }, { status: 400 });
    }

    const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;
    if (!OWNER_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "OWNER_PRIVATE_KEY chưa được cấu hình" },
        { status: 500 }
      );
    }

    // Lấy role từ database
    await ensureTableExists("users", TABLE_DEFINITIONS.users);
    const { rows } = await pool.query(
      'SELECT role FROM users WHERE address = $1',
      [address.toLowerCase()]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy người dùng trong database. Hãy đăng ký và chờ admin duyệt trước." },
        { status: 404 }
      );
    }

    const roleString = rows[0].role;

    // Convert role string → Role enum number
    let roleNumber: number;
    switch (roleString.toUpperCase()) {
      case 'MANUFACTURER': roleNumber = Role.MANUFACTURER; break;
      case 'DISTRIBUTOR':  roleNumber = Role.DISTRIBUTOR;  break;
      case 'PHARMACY':      roleNumber = Role.PHARMACY;     break;
      case 'ADMIN':         roleNumber = Role.ADMIN;        break;
      default:
        return NextResponse.json(
          { error: `Role không hợp lệ: ${roleString}` },
          { status: 400 }
        );
    }

    console.log(`[sync-role] Gán role ${roleString} (${roleNumber}) cho ${address}`);

    const txResult = await assignRole(address, roleNumber, OWNER_PRIVATE_KEY);

    if (!txResult.success) {
      const errMsg = txResult.error || 'Transaction failed';
      const hints = getSuiErrorHints(new Error(errMsg));

      return NextResponse.json({
        success: false,
        error: "Đồng bộ blockchain thất bại",
        detail: errMsg,
        hints: [
          "Kiểm tra OWNER_PRIVATE_KEY có ADMIN role trong contract",
          "Kiểm tra ví có đủ SUI để trả gas",
          "Kiểm tra RPC endpoint Sui hoạt động",
          ...hints,
        ],
      }, { status: 200 }); // 200 để frontend xử lý được response body
    }

    return NextResponse.json({
      success: true,
      message: `Đã đồng bộ quyền ${roleString} lên blockchain cho ${address}`,
      transactionDigest: txResult.digest,
    });

  } catch (error: any) {
    console.error('[sync-role] Error:', error);
    return NextResponse.json(
      { error: "Lỗi khi đồng bộ role", detail: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/sync-role
 * Lấy danh sách users từ database
 */
export async function GET() {
  try {
    const { rows } = await pool.query(
      'SELECT address, role FROM users ORDER BY assigned_at DESC'
    );
    return NextResponse.json({ success: true, users: rows });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Lỗi khi lấy danh sách users", detail: error.message },
      { status: 500 }
    );
  }
}
