import { NextRequest, NextResponse } from 'next/server';
import { assignRole, ContractRole } from "@/lib/blockchain/contract";
import { parseEthersError } from "@/lib/blockchain/errors";
import { getExplorerTxUrl } from "@/lib/blockchain/config";

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
      ContractRole.Manufacturer,
      OWNER_PRIVATE_KEY
    );
    
    const receipt = await txResult.wait();

    return NextResponse.json({ 
      success: true, 
      txHash: txResult.hash,
      explorerUrl: getExplorerTxUrl(txResult.hash),
      blockNumber: receipt.blockNumber,
      message: `✅ Đã tự động cấp quyền Manufacturer cho địa chỉ ${address}`
    });
  } catch (err: any) {
    const blockchainError = parseEthersError(err);
    console.error("Error auto-assigning role:", blockchainError);
    
    return NextResponse.json({ 
      error: "Lỗi khi cấp quyền",
      detail: blockchainError.message,
      code: blockchainError.code,
    }, { status: 500 });
  }
} 