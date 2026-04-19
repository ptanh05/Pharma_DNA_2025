/**
 * API Route: GET /api/manufacturer
 * Tra cứu NFT theo batch_number hoặc name (public)
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from "@/lib/db";
import { logger } from '@/lib/utils/logger';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batch_number = searchParams.get("batch_number");
    const name = searchParams.get("name");

    if (!batch_number && !name) {
      return NextResponse.json(
        { error: "Cần cung cấp batch_number hoặc name" },
        { status: 400 }
      );
    }

    let query = `
      SELECT
        id,
        name,
        batch_number,
        status,
        manufacturer_address,
        distributor_address,
        pharmacy_address,
        ipfs_hash,
        description,
        created_at,
        updated_at
      FROM nfts
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (batch_number) {
      query += ` AND batch_number = $${idx}`;
      params.push(batch_number);
      idx++;
    }

    if (name) {
      query += ` AND name ILIKE $${idx}`;
      params.push(`%${name}%`);
      idx++;
    }

    query += ` LIMIT 1`;

    const result = await pool.query(query, params);

    if (!result.rows.length) {
      return NextResponse.json(null, { status: 200 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    logger.error('API_MANUFACTURER', 'GET manufacturer error', error);
    return NextResponse.json(
      { error: error.message || 'Có lỗi xảy ra' },
      { status: 500 }
    );
  }
}
