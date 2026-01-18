import { NextRequest, NextResponse } from 'next/server';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { getPackageId, getContractObjectId, getSuiClient } from '@/lib/blockchain/provider-sui';

/**
 * POST /api/blockchain/build-mint-transaction
 * Build transaction block for NFT mint (client-side signing)
 * 
 * Body: { uri: string, batchNumber: string, expiryDate?: number }
 */
export async function POST(req: NextRequest) {
  try {
    const { uri, batchNumber, expiryDate } = await req.json();

    if (!uri || !batchNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: uri and batchNumber are required' },
        { status: 400 }
      );
    }

    const packageId = getPackageId();
    const contractObjectId = getContractObjectId();
    const client = getSuiClient();

    // Default expiry date: 1 year from now (in milliseconds)
    const expiry = expiryDate || Math.floor(Date.now()) + (365 * 24 * 60 * 60 * 1000);

    // Build transaction block
    const txb = new TransactionBlock();
    
    // Mint NFT - contract will transfer to caller automatically
    txb.moveCall({
      target: `${packageId}::pharma_nft::mint_product_nft`,
      arguments: [
        txb.object(contractObjectId),    // Contract object
        txb.pure(uri),                   // URI (IPFS hash)
        txb.pure(batchNumber),           // Batch number
        txb.pure(expiry),                // Expiry date (milliseconds)
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
    console.error('Error building mint transaction:', error);
    return NextResponse.json(
      { 
        error: 'Failed to build transaction',
        detail: error.message || String(error),
      },
      { status: 500 }
    );
  }
}

