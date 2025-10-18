import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { ethers } from "ethers";
import pharmaNFTAbi from "@/lib/pharmaNFT-abi.json";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const PHARMA_NFT_ADDRESS = process.env.NEXT_PUBLIC_PHARMA_NFT_ADDRESS;
const PHARMADNA_RPC = process.env.PHARMADNA_RPC || "https://pharmadna-2759821881746000-1.jsonrpc.sagarpc.io";
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

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

    if (!PHARMA_NFT_ADDRESS || PHARMA_NFT_ADDRESS === '0x' || PHARMA_NFT_ADDRESS.length < 10) {
      throw new Error("PHARMA_NFT_ADDRESS is not configured");
    }
    const code = await provider.getCode(PHARMA_NFT_ADDRESS);
    if (!code || code === '0x') {
      throw new Error(`No contract code at PHARMA_NFT_ADDRESS: ${PHARMA_NFT_ADDRESS}`);
    }
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

    const tx = await contract.assignRole(address, roleEnum);
    await tx.wait();
    // Kiểm tra lại role trên contract
    const roleOnChain = await contract.roles(address);
    
  } catch (err: any) {
    console.error("Lỗi khi đồng bộ quyền lên contract:", err);
    return NextResponse.json({
      error: "Lỗi khi đồng bộ quyền lên contract",
      detail: err?.message || String(err),
      hints: [
        "Kiểm tra PHARMA_NFT_ADDRESS đã đúng địa chỉ contract trên PharmaDNA",
        "Đảm bảo OWNER_PRIVATE_KEY có số dư PDNA và là owner của contract",
        "Kiểm tra RPC endpoint PharmaDNA hoạt động"
      ]
    }, { status: 500 });
  }

  return NextResponse.json({ 
    success: true, 
    message: `✅ Đã cấp quyền ${role} cho địa chỉ ${address} và đồng bộ lên blockchain thành công!` 
  });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const address = body.address?.toLowerCase();
  if (!address) return NextResponse.json({ error: 'Thiếu địa chỉ' }, { status: 400 });
  await pool.query('DELETE FROM users WHERE address = $1', [address]);
  return NextResponse.json({ success: true });
} 