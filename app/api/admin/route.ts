import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { assignRole } from "@/lib/blockchain/contract";
import { parseNeoError, getErrorHints } from "@/lib/blockchain/errors";
import { getExplorerTxUrl } from "@/lib/blockchain/config";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

export async function GET(req: NextRequest) {
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
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const address = body.address?.toLowerCase();
  const role = body.role;
  if (!address || !role) return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });
  const now = new Date().toISOString();

  // 1. Lưu vào DB như cũ
  await pool.query(
    `INSERT INTO users (address, role, assigned_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (address) DO UPDATE SET role = $2, assigned_at = $3`,
    [address, role, now]
  );

  // 2. Gọi transaction lên contract để đồng bộ quyền trên blockchain
  try {
    if (!OWNER_PRIVATE_KEY) {
      throw new Error("OWNER_PRIVATE_KEY is not configured");
    }

    // Use blockchain utilities (Neo N3)
    const txResult = await assignRole(address, role as any, OWNER_PRIVATE_KEY);

    if (!txResult.success) {
      throw new Error(txResult.error || 'Transaction failed');
    }

    return NextResponse.json({ 
      success: true, 
      message: `✅ Đã cấp quyền ${role} cho địa chỉ ${address} và đồng bộ lên blockchain thành công!`,
      transactionHash: txResult.txHash,
      explorerUrl: getExplorerTxUrl(txResult.txHash),
      blockNumber: txResult.blockNumber,
    });
  } catch (err: any) {
    const blockchainError = parseNeoError(err);
    console.error("Lỗi khi đồng bộ quyền lên contract:", blockchainError.message);
    
    const hints = getErrorHints(err);
    
    return NextResponse.json({
      error: "Lỗi khi đồng bộ quyền lên contract",
      detail: blockchainError.message,
      code: blockchainError.code,
      hints: [
        "Kiểm tra NEO_CONTRACT_HASH đã đúng địa chỉ contract trên Neo N3",
        "Đảm bảo OWNER_PRIVATE_KEY có số dư GAS và là owner của contract",
        "Kiểm tra RPC endpoint Neo N3 hoạt động",
        ...hints,
      ]
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const address = body.address?.toLowerCase();
  if (!address) return NextResponse.json({ error: 'Thiếu địa chỉ' }, { status: 400 });
  await pool.query('DELETE FROM users WHERE address = $1', [address]);
  return NextResponse.json({ success: true });
} 