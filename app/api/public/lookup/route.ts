/**
 * API Route: GET /api/public/lookup
 * Tra cứu công khai sản phẩm
 *
 * Query Parameters:
 * - batch: Batch number (string)
 * - nftId: NFT ID (number)
 */

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { z } from "zod";
import { getCache, setCache, CACHE_KEYS, CACHE_TTLs } from "@/lib/cache";
import { logger } from '@/lib/utils/logger';

const lookupSchema = z.object({
  batch: z.string().min(1, "Batch number không được để trống").optional().nullable(),
  nftId: z.coerce.number().int().positive().optional().nullable(),
}).refine((data) => data.batch || data.nftId, {
  message: "Cần cung cấp batch number hoặc NFT ID",
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawBatch = searchParams.get("batch");
    const rawNftId = searchParams.get("nftId");

    // Validate input — use .nullable() to handle null from searchParams.get()
    const validatedData = lookupSchema.parse({
      batch: rawBatch,
      nftId: rawNftId,
    });

    // Check cache first
    let cacheKey: string | null = null;
    if (validatedData.batch) {
      cacheKey = CACHE_KEYS.PUBLIC_LOOKUP(validatedData.batch);
    } else if (validatedData.nftId) {
      cacheKey = `public:lookup:nft:${validatedData.nftId}`;
    }

    if (cacheKey) {
      const cachedResult = await getCache(cacheKey);
      if (cachedResult) {
        return NextResponse.json(cachedResult, { status: 200 });
      }
    }

    let nft;

    if (validatedData.batch) {
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
          description,
          image_url,
          certificate_url,
          quantity,
          manufacture_date,
          expiry_date,
          token_id,
          object_id,
          transaction_digest,
          transaction_hash,
          last_dispensed_at,
          receipt_confirmed_at,
          updated_at
        FROM nfts
        WHERE batch_number = $1
        LIMIT 1
      `;
      const result = await pool.query(query, [validatedData.batch]);
      nft = result.rows[0];
    } else if (validatedData.nftId) {
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
          description,
          image_url,
          certificate_url,
          quantity,
          manufacture_date,
          expiry_date,
          token_id,
          object_id,
          transaction_digest,
          transaction_hash,
          last_dispensed_at,
          receipt_confirmed_at,
          updated_at
        FROM nfts
        WHERE id = $1
        LIMIT 1
      `;
      const result = await pool.query(query, [validatedData.nftId]);
      nft = result.rows[0];
    }

    if (!nft) {
      const response = {
        success: true,
        data: null,
        message: "Không tìm thấy sản phẩm",
      };
      if (cacheKey) {
        await setCache(cacheKey, response, CACHE_TTLs.MEDIUM);
      }
      return NextResponse.json(response, { status: 200 });
    }

    const response = {
      success: true,
      data: nft,
    };
    if (cacheKey) {
      await setCache(cacheKey, response, CACHE_TTLs.MEDIUM);
    }
    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    logger.error('API_PUBLIC', 'GET lookup error', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation error",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Lỗi khi tra cứu sản phẩm",
      },
      { status: 500 }
    );
  }
}
