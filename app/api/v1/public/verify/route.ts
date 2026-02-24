/**
 * API Route: GET /api/v1/public/verify
 * Xác minh sản phẩm trên blockchain
 * 
 * Query Parameters:
 * - batch: Batch number
 */

import { NextRequest, NextResponse }from 'next/server';
import { pool }from '@/lib/db/connection';
import { getTokenProperties }from '@/lib/blockchain/contract-sui';

export async function GET(req: NextRequest) {
  try {
    const { searchParams }= new URL(req.url);
    const batch = searchParams.get('batch');

    if (!batch) {
      return NextResponse.json(
        {
          success: false,
          error: 'Batch number là bắt buộc',
        },
        { status: 400 }
      );
    }

    // Lấy NFT từ database
    const dbQuery = `
      SELECT 
        id,
        batch_number,
        token_id,
        status,
        pharmacy_address
      FROM nfts 
      WHERE batch_number = $1 
      LIMIT 1
    `;
    const dbResult = await pool.query(dbQuery, [batch]);

    if (!dbResult.rows.length) {
      return NextResponse.json(
        {
          success: true,
          verified: false,
          message: 'Sản phẩm không tìm thấy trong hệ thống',
        },
        { status: 200 }
      );
    }

    const nft = dbResult.rows[0];

    // Nếu không có token_id, không thể verify trên blockchain
    if (!nft.token_id) {
      return NextResponse.json(
        {
          success: true,
          verified: false,
          message: 'Sản phẩm chưa được đăng ký trên blockchain',
        },
        { status: 200 }
      );
    }

    try {
      // Lấy thông tin từ blockchain
      const blockchainNFT = await getTokenProperties(nft.token_id);

      if (!blockchainNFT) {
        return NextResponse.json(
          {
            success: true,
            verified: false,
            message: 'Không tìm thấy NFT trên blockchain',
          },
          { status: 200 }
        );
      }

      // Verify: Check xem current owner có phải là pharmacy hay không
      const expectedOwner = nft.pharmacy_address || nft.token_id;
      const isVerified = blockchainNFT.owner === expectedOwner || nft.status === 'dispensed';

      return NextResponse.json(
        {
          success: true,
          verified: isVerified,
          blockchainInfo: {
            owner: blockchainNFT.owner,
            status: nft.status,
            lastUpdated: new Date().toISOString(),
          },
        },
        { status: 200 }
      );
    }catch (blockchainError) {
      console.error('[VerifyAPI] Blockchain lookup error:', blockchainError);

      // Nếu blockchain lookup fail, vẫn trả về verified dựa trên database
      return NextResponse.json(
        {
          success: true,
          verified: true,
          message: 'Xác minh từ cơ sở dữ liệu (blockchain không khả dụng)',
          blockchainInfo: {
            status: nft.status,
          },
        },
        { status: 200 }
      );
    }
  }catch (error: any) {
    console.error('[VerifyAPI] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Lỗi khi xác minh sản phẩm',
      },
      { status: 500 }
    );
  }
}
