/**
 * Debug API - Sync NFT from blockchain to database
 * app/api/debug/sync-nft/route.ts
 */

import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { SuiClient } from '@mysten/sui.js/client';
import { getSuiRpcUrl } from "@/lib/blockchain/config-sui";

/**
 * POST /api/debug/sync-nft
 * Body: { objectId: string, manufacturerAddress: string }
 *
 * Tìm NFT trên blockchain và lưu vào database nếu chưa có
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { objectId, manufacturerAddress } = body;

    if (!objectId || !manufacturerAddress) {
      return Response.json({
        success: false,
        error: 'Missing objectId or manufacturerAddress'
      }, { status: 400 });
    }

    console.log('[debug/sync-nft] Syncing NFT:', { objectId, manufacturerAddress });

    // Lấy NFT từ blockchain
    const rpcUrl = getSuiRpcUrl();
    const client = new SuiClient({ url: rpcUrl });

    const nftObject = await client.getObject({
      id: objectId,
      options: { showContent: true, showOwner: true },
    });

    if (!nftObject.data) {
      return Response.json({
        success: false,
        error: 'NFT not found on blockchain'
      }, { status: 404 });
    }

    console.log('[debug/sync-nft] NFT object:', JSON.stringify(nftObject.data, null, 2));

    // Kiểm tra xem NFT đã có trong DB chưa (theo object_id)
    const existingByObjectId = await pool.query(
      'SELECT * FROM nfts WHERE object_id = $1 OR token_id = $1',
      [objectId]
    );

    if (existingByObjectId.rows.length > 0) {
      return Response.json({
        success: true,
        message: 'NFT already exists in database',
        nft: existingByObjectId.rows[0],
      });
    }

    // Lấy thông tin từ NFT content
    let batchNumber = 'UNKNOWN';
    let expiryDate = null;

    if (nftObject.data.content && nftObject.data.content.dataType === 'moveObject') {
      const fields = (nftObject.data.content as any).fields;
      if (fields) {
        batchNumber = fields.batch_number || fields.batchNumber || 'UNKNOWN';
        expiryDate = fields.expiry_date || fields.expiryDate || null;
      }
    }

    // Kiểm tra xem đã có NFT với batch_number này chưa
    const existingByBatch = await pool.query(
      'SELECT * FROM nfts WHERE batch_number = $1 AND manufacturer_address = $2',
      [batchNumber, manufacturerAddress.toLowerCase()]
    );

    let result;
    if (existingByBatch.rows.length > 0) {
      // Update existing NFT với object_id mới
      console.log('[debug/sync-nft] Updating existing NFT with object_id');
      result = await pool.query(
        `UPDATE nfts SET object_id = $1, token_id = $1, status = 'minted', updated_at = NOW()
         WHERE batch_number = $2 AND manufacturer_address = $3 RETURNING *`,
        [objectId, batchNumber, manufacturerAddress.toLowerCase()]
      );
    } else {
      // Insert mới nếu chưa có
      result = await pool.query(
        `INSERT INTO nfts (name, status, created_at, manufacturer_address, batch_number, token_id, object_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          `NFT-${objectId.slice(0, 8)}`,
          'minted',
          new Date().toISOString(),
          manufacturerAddress.toLowerCase(),
          batchNumber,
          objectId,
          objectId,
        ]
      );
    }

    console.log('[debug/sync-nft] NFT synced successfully:', result.rows[0]);

    return Response.json({
      success: true,
      message: 'NFT synced to database',
      nft: result.rows[0],
    });
  } catch (error: any) {
    console.error('[debug/sync-nft] Error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
