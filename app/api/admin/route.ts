import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { ethers } from "ethers";
import pharmaNFTAbi from "@/lib/pharmaNFT-abi.json";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const PHARMA_NFT_ADDRESS = process.env.PHARMA_NFT_ADDRESS || "0xaa3f88a6b613985f3D97295D6BAAb6246c2699c6";
const PHARMADNA_RPC = "https://pharmadna-2759821881746000-1.jsonrpc.sagarpc.io";
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY; // Đặt biến này trong .env, không public!

export async function GET() {
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
    if (!OWNER_PRIVATE_KEY) throw new Error("OWNER_PRIVATE_KEY not set");
    const provider = new ethers.JsonRpcProvider(PHARMADNA_RPC);
    const ownerWallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(PHARMA_NFT_ADDRESS, pharmaNFTAbi.abi || pharmaNFTAbi, ownerWallet);

    // Map role string to enum value
    const roleEnumMap: Record<string, number> = {
      "MANUFACTURER": 1,
      "DISTRIBUTOR": 2,
      "PHARMACY": 3,
      "ADMIN": 4,
    };
    const roleEnum = roleEnumMap[String(role)];
    if (!roleEnum) throw new Error("Role không hợp lệ");

    console.log("Assigning role on contract:", address, roleEnum);
    const tx = await contract.assignRole(address, roleEnum);
    console.log("Tx hash:", tx.hash);
    await tx.wait();
    // Kiểm tra lại role trên contract
    const roleOnChain = await contract.roles(address);
    console.log("Role on chain after assign:", roleOnChain);
  } catch (err: any) {
    console.error("Lỗi khi đồng bộ quyền lên contract:", err);
    return NextResponse.json({ error: "Lỗi khi đồng bộ quyền lên contract", detail: err.message, stack: err.stack }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const address = body.address?.toLowerCase();
  if (!address) return NextResponse.json({ error: 'Thiếu địa chỉ' }, { status: 400 });
  await pool.query('DELETE FROM users WHERE address = $1', [address]);
  return NextResponse.json({ success: true });
} 