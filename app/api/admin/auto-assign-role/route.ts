import { NextRequest, NextResponse } from 'next/server';
import { assignRole, ContractRole } from "@/lib/blockchain/contract";
import { parseSuiError } from "@/lib/blockchain/errors-sui";
import { getExplorerTxUrl } from "@/lib/blockchain/contract";

// FIXED: Force dynamic rendering to prevent SSG/prerender
export const dynamic = 'force-dynamic';

const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

export async function POST(req: NextRequest) {
  const { address } = await req.json();
  
  if (!address) {
    return NextResponse.json({ error: "Thiếu địa chỉ" }, { status: 400 });
  }

  try {
    if (!OWNER_PRIVATE_KEY) {
      throw new Error("OWNER_PRIVATE_KEY is not configured");
    }

    // Use blockchain utilities
    const txResult = await assignRole(
      address,
      ContractRole.MANUFACTURER,
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
      message: `✅ Đã tự động cấp quyền Manufacturer cho địa chỉ ${address}`
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