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
    const { uri, batchNumber, expiryDate, sender } = await req.json();

    if (!uri || !batchNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: uri and batchNumber are required' },
        { status: 400 }
      );
    }

    if (!sender) {
      return NextResponse.json(
        { error: 'Missing required field: sender address is required' },
        { status: 400 }
      );
    }

    // Validate sender address format
    if (!sender.startsWith('0x') || (sender.length !== 42 && sender.length !== 66)) {
      return NextResponse.json(
        { error: 'Invalid sender address format. Must be Ethereum (42 chars) or Sui (66 chars) address starting with 0x' },
        { status: 400 }
      );
    }

    let packageId: string;
    let contractObjectId: string;
    
    try {
      packageId = getPackageId();
      contractObjectId = getContractObjectId();
    } catch (error: any) {
      console.error('Error getting contract IDs:', error);
      return NextResponse.json(
        { 
          error: 'Contract not configured',
          detail: error.message || 'SUI_PACKAGE_ID or SUI_CONTRACT_OBJECT_ID not found in environment variables',
        },
        { status: 500 }
      );
    }

    const client = getSuiClient();

    // Default expiry date: 1 year from now (in milliseconds)
    const now = Date.now();
    const expiry = expiryDate || (now + (365 * 24 * 60 * 60 * 1000));
    
    // Validate expiry date is in the future
    if (expiry <= now) {
      return NextResponse.json(
        { error: 'Expiry date must be in the future' },
        { status: 400 }
      );
    }

    // Validate expiry date is not too far (max 10 years)
    const maxExpiry = now + (10 * 365 * 24 * 60 * 60 * 1000);
    if (expiry > maxExpiry) {
      return NextResponse.json(
        { error: 'Expiry date cannot be more than 10 years in the future' },
        { status: 400 }
      );
    }

    console.log('Building mint transaction with params:', {
      packageId,
      contractObjectId,
      uri,
      batchNumber,
      expiry,
      expiryDate: new Date(expiry).toISOString(),
      sender,
    });

    // Build transaction block
    const txb = new TransactionBlock();
    
    // Set sender address (required for building transaction)
    txb.setSender(sender);
    
    try {
      // Mint NFT - contract will transfer to caller automatically
      // Note: If contract hasn't been redeployed with Clock parameter, this will fail
      // The contract signature is: mint_product_nft(contract, uri, batch_number, expiry_date, clock, ctx)
      txb.moveCall({
        target: `${packageId}::pharma_nft::mint_product_nft`,
        arguments: [
          txb.object(contractObjectId),    // Contract object
          txb.pure(uri),                   // URI (IPFS hash) as vector<u8>
          txb.pure(batchNumber),           // Batch number as vector<u8>
          txb.pure(expiry, 'u64'),         // Expiry date (milliseconds) as u64
          txb.object('0x6'),               // Clock object (Sui standard shared object)
        ],
      });
    } catch (moveCallError: any) {
      console.error('Error creating moveCall:', moveCallError);
      return NextResponse.json(
        { 
          error: 'Failed to create transaction call',
          detail: moveCallError.message || String(moveCallError),
          hint: 'Make sure the contract has been redeployed with Clock parameter support',
        },
        { status: 500 }
      );
    }

    // Build transaction block (chưa ký)
    let transactionBlock: Uint8Array;
    try {
      transactionBlock = await txb.build({ client });
      console.log('Transaction block built successfully, size:', transactionBlock.length);
    } catch (buildError: any) {
      console.error('Error building transaction block:', buildError);
      
      // Check if it's a contract-related error
      const errorMessage = buildError.message || String(buildError);
      if (errorMessage.includes('function') || errorMessage.includes('signature') || errorMessage.includes('argument')) {
        return NextResponse.json(
          { 
            error: 'Contract function signature mismatch',
            detail: errorMessage,
            hint: 'The contract may need to be redeployed. Current contract expects: mint_product_nft(contract, uri, batch_number, expiry_date, clock, ctx)',
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to build transaction block',
          detail: errorMessage,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transactionBlock: Array.from(transactionBlock), // Convert Uint8Array to array for JSON
      message: 'Transaction block built successfully. Sign and execute from frontend.',
    });
  } catch (error: any) {
    console.error('Unexpected error building mint transaction:', error);
    return NextResponse.json(
      { 
        error: 'Failed to build transaction',
        detail: error.message || String(error),
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

