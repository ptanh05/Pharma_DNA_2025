import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { assignRole } from "@/lib/blockchain/contract";
import { parseSuiError, getSuiErrorHints } from "@/lib/blockchain/errors-sui";
import { getExplorerTxUrl } from "@/lib/blockchain/contract";
import { assignRoleSchema, suiAddressSchema } from "@/lib/validation/schemas";
import { validateAndSanitizeRequest, validationErrorResponse, sanitizeAddress } from "@/lib/validation/middleware";
import { withRateLimit, rateLimitConfigs } from "@/lib/middleware/rate-limit-wrapper";
import { trackAPI, successResponse, errorResponse, handleAPIError } from "@/lib/utils/api-helpers";

// FIXED: Force dynamic rendering to prevent SSG/prerender
export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Đảm bảo bảng users tồn tại để tránh lỗi 500 khi query lần đầu
async function ensureUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      address TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      assigned_at TIMESTAMPTZ NOT NULL
    )
  `);
}

const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

export async function GET(req: NextRequest) {
  try {
    await ensureUsersTable();

    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address')?.toLowerCase();
    
    if (address) {
      // Query single user by address
      const { rows } = await pool.query(
        'SELECT address, role, assigned_at FROM users WHERE address = $1',
        [address]
      );
      if (rows.length === 0) {
        return NextResponse.json({ address, role: null }, { status: 404 });
      }
      const user = rows[0];
      return NextResponse.json({
        address: user.address.toLowerCase(),
        role: user.role,
        assignedAt: user.assigned_at,
      });
    }
    
    // Return all users
    const { rows } = await pool.query('SELECT address, role, assigned_at FROM users');
    const users = rows.map((u: { address: string; role: string; assigned_at: string }) => ({
      ...u,
      address: u.address.toLowerCase(),
      assignedAt: u.assigned_at,
    }));
    return NextResponse.json(users);
  } catch (err: any) {
    console.error('GET /api/admin error:', err);
    return NextResponse.json(
      { error: 'Lỗi máy chủ khi lấy danh sách user', detail: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureUsersTable();

    const body = await req.json();
    
    // Validate request body
    const validation = validateAndSanitizeRequest(assignRoleSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }

    const { address, role } = validation.data;
    const sanitizedAddress = sanitizeAddress(address);
    const now = new Date().toISOString();

    // 1. Lưu vào DB
    await pool.query(
      `INSERT INTO users (address, role, assigned_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (address) DO UPDATE SET role = $2, assigned_at = $3`,
      [sanitizedAddress, role, now]
    );

    // 2. Gọi transaction lên contract để đồng bộ quyền trên blockchain (nếu có cấu hình key)
    if (!OWNER_PRIVATE_KEY) {
      console.warn("OWNER_PRIVATE_KEY is not configured. Skipping blockchain sync.");
      return NextResponse.json({
        success: true,
        message: `✅ Đã lưu quyền ${role} cho địa chỉ ${sanitizedAddress} trong hệ thống (chưa đồng bộ blockchain vì thiếu OWNER_PRIVATE_KEY)`,
        blockchainSynced: false,
      });
    }

    try {
      const txResult = await assignRole(sanitizedAddress, role as any, OWNER_PRIVATE_KEY);

      if (!txResult.success) {
        throw new Error(txResult.error || 'Transaction failed');
      }

      return NextResponse.json({ 
        success: true, 
        message: `✅ Đã cấp quyền ${role} cho địa chỉ ${sanitizedAddress} và đồng bộ lên blockchain thành công!`,
        transactionHash: txResult.digest,
        transactionDigest: txResult.digest,
        explorerUrl: getExplorerTxUrl(txResult.digest),
        checkpoint: txResult.checkpoint,
        blockchainSynced: true,
      });
    } catch (err: any) {
      const blockchainError = parseSuiError(err);
      console.error("Lỗi khi đồng bộ quyền lên contract:", blockchainError);
      
      const hints = getSuiErrorHints(err);
      
      return NextResponse.json({
        success: true,
        message: `✅ Đã lưu quyền ${role} cho địa chỉ ${sanitizedAddress} trong hệ thống, nhưng đồng bộ blockchain thất bại`,
        blockchainSynced: false,
        error: "Lỗi khi đồng bộ quyền lên contract",
        detail: blockchainError,
        hints: [
          "Kiểm tra SUI_PACKAGE_ID và SUI_CONTRACT_OBJECT_ID đã đúng",
          "Đảm bảo OWNER_PRIVATE_KEY có số dư SUI và là admin của contract",
          "Kiểm tra RPC endpoint Sui hoạt động",
          ...hints,
        ]
      });
    }
  } catch (err: any) {
    console.error('POST /api/admin error:', err);
    return NextResponse.json(
      { error: 'Lỗi máy chủ khi lưu/cập nhật quyền', detail: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureUsersTable();

    const body = await req.json();
    
    // Validate address format
    const addressValidation = suiAddressSchema.safeParse(sanitizeAddress(body.address || ""));
    if (!addressValidation.success) {
      return validationErrorResponse(
        "Địa chỉ không hợp lệ",
        addressValidation.error.errors
      );
    }
    
    const sanitizedAddress = addressValidation.data.toLowerCase();
    await pool.query('DELETE FROM users WHERE address = $1', [sanitizedAddress]);
    return NextResponse.json({ 
      success: true,
      message: `✅ Đã xóa quyền của địa chỉ ${sanitizedAddress} thành công!`
    });
  } catch (err: any) {
    console.error('DELETE /api/admin error:', err);
    return NextResponse.json(
      { error: 'Lỗi máy chủ khi xóa quyền', detail: err.message },
      { status: 500 }
    );
  }
} 