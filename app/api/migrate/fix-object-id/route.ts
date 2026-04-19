/**
 * POST /api/migrate/fix-object-id
 *
 * Migration: Fix object_id cho NFT cũ trong database.
 *
 * Vấn đề: Một số NFT cũ lưu batch_number (VD: "LOT202506AW")
 * trong cột object_id thay vì Sui object ID thật (0x...).
 * Script này scan blockchain để tìm object_id đúng và cập nhật vào DB.
 *
 * Preview (GET): Xem trước NFT nào sẽ bị ảnh hưởng
 * Run    (POST): Thực hiện migration
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { lookupNFTByBatchNumber } from '@/lib/blockchain/contract-sui';
import { logger } from '@/lib/utils/logger';

export async function GET(req: NextRequest) {
  try {
    // Lấy danh sách NFT có object_id không hợp lệ
    const result = await pool.query(`
      SELECT
        id,
        name,
        batch_number,
        object_id,
        manufacturer_address,
        status,
        transaction_digest,
        created_at
      FROM nfts
      WHERE
        (object_id IS NULL OR object_id = '' OR object_id NOT LIKE '0x%')
        AND batch_number IS NOT NULL
        AND batch_number != ''
      ORDER BY created_at DESC
      LIMIT 100
    `);

    return NextResponse.json({
      success: true,
      message: 'Preview — những NFT cần được fix',
      count: result.rows.length,
      nfts: result.rows,
    });
  } catch (error: any) {
    logger.error('MIGRATE_FIX_OBJECT_ID', 'Preview failed', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const results: {
    total: number;
    fixed: number;
    failed: number;
    skipped: number;
    details: Array<{
      nftId: number;
      batchNumber: string;
      oldObjectId: string | null;
      newObjectId: string | null;
      status: 'fixed' | 'failed' | 'skipped' | 'not_on_blockchain';
      error?: string;
    }>;
  } = {
    total: 0,
    fixed: 0,
    failed: 0,
    skipped: 0,
    details: [],
  };

  try {
    // 1. Lấy tất cả NFT cần fix (object_id không phải 0x...)
    const nftsToFix = await pool.query(`
      SELECT id, batch_number, object_id, manufacturer_address, status
      FROM nfts
      WHERE
        (object_id IS NULL OR object_id = '' OR object_id NOT LIKE '0x%')
        AND batch_number IS NOT NULL
        AND batch_number != ''
      ORDER BY created_at DESC
    `);

    results.total = nftsToFix.rows.length;

    if (results.total === 0) {
      return NextResponse.json({
        success: true,
        message: 'Không có NFT nào cần fix. Tất cả object_id đã đúng.',
        ...results,
        duration_ms: Date.now() - startTime,
      });
    }

    logger.info('MIGRATE_FIX_OBJECT_ID', `Found ${results.total} NFTs to fix`);

    // 2. Xử lý từng NFT
    for (const nft of nftsToFix.rows) {
      const { id, batch_number, object_id: oldObjectId, manufacturer_address } = nft;

      // 2a. Nếu status = 'created' (chưa mint) → skip
      if (nft.status === 'created') {
        results.skipped++;
        results.details.push({
          nftId: id,
          batchNumber: batch_number,
          oldObjectId,
          newObjectId: null,
          status: 'skipped',
          error: 'NFT chưa được mint (status=created), không có trên blockchain',
        });
        continue;
      }

      // 2b. Nếu không có manufacturer_address → skip
      if (!manufacturer_address || !manufacturer_address.startsWith('0x')) {
        results.skipped++;
        results.details.push({
          nftId: id,
          batchNumber: batch_number,
          oldObjectId,
          newObjectId: null,
          status: 'skipped',
          error: 'Không có manufacturer_address hợp lệ để tra cứu',
        });
        continue;
      }

      // 2c. Tra cứu object_id trên blockchain
      try {
        const realObjectId = await lookupNFTByBatchNumber(
          batch_number,
          manufacturer_address
        );

        if (realObjectId && realObjectId.startsWith('0x')) {
          // Tìm thấy → cập nhật DB
          await pool.query(
            `UPDATE nfts
               SET object_id = $1, token_id = $1, updated_at = NOW()
             WHERE id = $2`,
            [realObjectId, id]
          );

          results.fixed++;
          results.details.push({
            nftId: id,
            batchNumber: batch_number,
            oldObjectId,
            newObjectId: realObjectId,
            status: 'fixed',
          });

          logger.info('MIGRATE_FIX_OBJECT_ID', `Fixed NFT #${id} (${batch_number}): ${oldObjectId} → ${realObjectId}`);
        } else {
          // Không tìm thấy trên blockchain → đánh dấu
          results.failed++;
          results.details.push({
            nftId: id,
            batchNumber: batch_number,
            oldObjectId,
            newObjectId: null,
            status: 'not_on_blockchain',
            error: 'Không tìm thấy NFT trên blockchain. Có thể transaction mint thất bại.',
          });

          logger.warn('MIGRATE_FIX_OBJECT_ID', `NFT #${id} (${batch_number}) không tìm thấy trên blockchain`);
        }
      } catch (lookupError: any) {
        results.failed++;
        results.details.push({
          nftId: id,
          batchNumber: batch_number,
          oldObjectId,
          newObjectId: null,
          status: 'failed',
          error: lookupError.message,
        });

        logger.error('MIGRATE_FIX_OBJECT_ID', `Lỗi khi xử lý NFT #${id}`, lookupError);
      }
    }

    const duration = Date.now() - startTime;
    logger.info('MIGRATE_FIX_OBJECT_ID', `Migration completed`, {
      total: results.total,
      fixed: results.fixed,
      failed: results.failed,
      skipped: results.skipped,
      duration_ms: duration,
    });

    return NextResponse.json({
      success: true,
      message: `Migration hoàn tất trong ${duration}ms`,
      ...results,
      duration_ms: duration,
    });
  } catch (error: any) {
    logger.error('MIGRATE_FIX_OBJECT_ID', 'Migration failed', error);
    return NextResponse.json(
      { success: false, error: error.message, partial: results },
      { status: 500 }
    );
  }
}
