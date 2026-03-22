import { NextRequest, NextResponse } from 'next/server';
import { assignRole, ContractRole } from "@/lib/blockchain/contract";
import { parseSuiError } from "@/lib/blockchain/errors-sui";
import { getExplorerTxUrl } from "@/lib/blockchain/contract";
import { adminAuthService } from "@/lib/auth/admin-auth";

// FIXED: Force dynamic rendering to prevent SSG/prerender
export const dynamic = 'force-dynamic';

const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

export async function POST(req: NextRequest) {
  // Require admin authentication
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (!token || !adminAuthService.verifyToken(token)) {
    return NextResponse.json({ error: "Yêu cầu quyền admin" }, { status: 401 });
  }

  const { address, role } = await req.json();

  if (!address) {
    return NextResponse.json({ error: "Thiếu địa chỉ" }, { status: 400 });
  }

  // Map role string to Role enum (default MANUFACTURER)
  const roleMap: Record<string, number> = {
    MANUFACTURER: ContractRole.MANUFACTURER,
    DISTRIBUTOR: ContractRole.DISTRIBUTOR,
    PHARMACY: ContractRole.PHARMACY,
    ADMIN: ContractRole.ADMIN,
  };
  const assignedRole = role ? (roleMap[role] ?? ContractRole.MANUFACTURER) : ContractRole.MANUFACTURER;

  try {
    if (!OWNER_PRIVATE_KEY) {
      throw new Error("OWNER_PRIVATE_KEY is not configured");
    }

    // Use blockchain utilities
    const txResult = await assignRole(
      address,
      assignedRole,
      OWNER_PRIVATE_KEY
    );

    if (!txResult.success) {
      throw new Error(txResult.error || "Failed to assign role");
    }

    return NextResponse.json({
      success: true,
      txHash: txResult.digest,
      transactionDigest: txResult.digest,
      explorerUrl: getExplorerTxUrl(txResult.digest),
      checkpoint: txResult.checkpoint,
      message: `✅ Đã cấp quyền cho địa chỉ ${address}`
    });
  } catch (err: any) {
    const blockchainError = parseSuiError(err);
    console.error("Error auto-assigning role:", blockchainError);

    return NextResponse.json({
      error: "Lỗi khi cấp quyền",
      detail: blockchainError,
    }, { status: 500 });
  }
} 