/**
 * API Route: GET /api/v1/public/lookup
 * Tra cứu công khai sản phẩm
 * 
 * Query Parameters:
 * - batch: Batch number (string)
 * - nftId: NFT ID (number)
 */

import { NextRequest, NextResponse }from 'next/server';
import { pool }from '@/lib/db/connection';

export async function GET(req: NextRequest) {
  try {
    const { searchParams }= new URL(req.url);
    const batch = searchParams.get('batch');
    const nftId = searchParams.get('nftId');

    // Validate input
    if (!batch && !nftId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cần cung cấp batch number hoặc NFT ID',
        },
        { status: 400 }
      );
    }

    let nft;

    if (batch) {
      // Tìm theo batch number
      const query = `
        SELECT 
          id, 
          name as product_name,
          batch_number, 
          status, 
          manufacturer_address,
          distributor_address,
          pharmacy_address,
          ipfs_hash,
          created_at,
          expiration_date
        FROM nfts 
        WHERE batch_number = $1 
        LIMIT 1
      `;
      const result = await pool.query(query, [batch]);
      nft = result.rows[0];
    } else if (nftId) {
      // Tìm theo NFT ID
      const query = `
        SELECT 
          id, 
          name as product_name,
          batch_number, 
          status, 
          manufacturer_address,
          distributor_address,
          pharmacy_address,
          ipfs_hash,
          created_at,
          expiration_date
        FROM nfts 
        WHERE id = $1 
        LIMIT 1
      `;
      const result = await pool.query(query, [parseInt(nftId)]);
      nft = result.rows[0];
    }

    if (!nft) {
      return NextResponse.json(
        {
          success: true,
          data: null,
          message: 'Không tìm thấy sản phẩm',
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: nft,
      },
      { status: 200 }
    );
  }catch (error: any) {
    console.error('[PublicLookupAPI] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Lỗi khi tra cứu sản phẩm',
      },
      { status: 500 }
    );
  }
}
