/**
 * Debug API - Check NFT data
 * app/api/debug/nfts/route.ts
 */

import { NextRequest } from "next/server";
import { pool } from "@/lib/db";

/**
 * GET /api/debug/nfts
 * Debug endpoint to check NFT data in database
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');

    let query = 'SELECT * FROM nfts ORDER BY created_at DESC LIMIT 20';
    let params: any[] = [];

    if (address) {
      query = 'SELECT * FROM nfts WHERE manufacturer_address = $1 ORDER BY created_at DESC LIMIT 20';
      params = [address.toLowerCase()];
    }

    const result = await pool.query(query, params);

    return Response.json({
      success: true,
      count: result.rows.length,
      nfts: result.rows,
      query: query,
      params: params,
    });
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
