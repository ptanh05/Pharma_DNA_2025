import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * POST /api/manufacturer/mint
 * Mint NFT on Neo N3 blockchain
 * 
 * Body: { ipfsHash: string, account: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { ipfsHash, account } = await req.json();
    
    if (!ipfsHash || !account) {
      return NextResponse.json(
        { error: 'Thiếu thông tin: ipfsHash và account là bắt buộc' },
        { status: 400 }
      );
    }

    // TODO: Implement Neo N3 minting
    // This should call lib/blockchain/contract-neo.ts mintProductNFT()
    // For now, we'll just save to database as a placeholder
    
    // Save to database
    const now = new Date().toISOString();
    const result = await pool.query(
      `INSERT INTO nfts (name, status, created_at, manufacturer_address, ipfs_hash)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [`NFT-${Date.now()}`, 'minted', now, account.toLowerCase(), ipfsHash]
    );

    return NextResponse.json({
      success: true,
      message: 'NFT đã được mint thành công (database)',
      nft: result.rows[0],
      // TODO: Add transaction hash when Neo N3 minting is implemented
      // transactionHash: txHash,
      // explorerUrl: getExplorerTxUrl(txHash),
    });
  } catch (error: any) {
    console.error('Mint NFT error:', error);
    return NextResponse.json(
      {
        error: 'Lỗi khi mint NFT',
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

