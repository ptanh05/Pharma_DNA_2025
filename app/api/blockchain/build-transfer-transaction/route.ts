import { NextRequest, NextResponse } from 'next/server';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { getPackageId, getContractObjectId, getSuiClient } from '@/lib/blockchain/provider-sui';

/**
 * POST /api/blockchain/build-transfer-transaction
 * Build transaction block for NFT transfer (client-side signing)
 * 
 * Body: { objectId: string, to: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { objectId, to, sender } = await req.json();

    if (!objectId || !to) {
      return NextResponse.json(
        { error: 'Missing required fields: objectId and to are required' },
        { status: 400 }
      );
    }

    if (!sender) {
      return NextResponse.json(
        { error: 'Missing required field: sender address is required' },
        { status: 400 }
      );
    }

    const packageId = getPackageId();
    const contractObjectId = getContractObjectId();
    const client = getSuiClient();

    // Build transaction block
    const txb = new TransactionBlock();
    
    // Set sender address (required for building transaction)
    txb.setSender(sender);
    
    txb.moveCall({
      target: `${packageId}::pharma_nft::transfer_product_nft`,
      arguments: [
        txb.object(objectId),           // NFT object
        txb.object(contractObjectId),    // Contract object
        txb.pure(to),                   // To address
        txb.object('0x6'),              // Clock object (Sui standard)
      ],
    });

    // Build transaction block (chưa ký)
    const transactionBlock = await txb.build({ client });

    return NextResponse.json({
      success: true,
      transactionBlock: Array.from(transactionBlock), // Convert Uint8Array to array for JSON
      message: 'Transaction block built successfully. Sign and execute from frontend.',
    });
  } catch (error: any) {
    console.error('Error building transfer transaction:', error);
    return NextResponse.json(
      { 
        error: 'Failed to build transaction',
        detail: error.message || String(error),
      },
      { status: 500 }
    );
  }
}

