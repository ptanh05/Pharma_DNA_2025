import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { saveNFTRequestSchema } from '@/lib/validation/schemas';
import { emitNFTMinted } from '@/lib/socket/events';
import { withRateLimit, rateLimitConfigs } from '@/lib/middleware/rate-limit-wrapper';
import { trackAPI } from '@/lib/utils/api-helpers';

/**
 * POST /api/manufacturer/save-nft
 * Save NFT to database after client-side minting
 * 
 * Body: { 
 *   objectId: string, 
 *   ipfsHash: string, 
 *   account: string, 
 *   batchNumber: string,
 *   transactionDigest: string 
 * }
 */
async function handlePOST(req: NextRequest) {
  return trackAPI("manufacturer:save-nft", async () => {
    try {
      const body = await req.json();
      
      console.log('[save-nft] Received request body:', {
        objectId: body.objectId,
        ipfsHash: body.ipfsHash,
        account: body.account,
        batchNumber: body.batchNumber,
        transactionDigest: body.transactionDigest,
      });
    
      // Validate and sanitize input
      let validation;
      try {
        console.log('[save-nft] Validating body:', JSON.stringify(body));
        const result = saveNFTRequestSchema.safeParse(body);
        if (!result.success) {
          const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
          throw new Error(errors.join(', '));
        }
        validation = result.data;
        console.log('[save-nft] Validation passed:', validation);
      } catch (error: any) {
        console.error('[save-nft] Validation failed:', error.message);
        console.error('[save-nft] Body received:', body);
        return NextResponse.json(
          { error: error.message, received: body },
          { status: 400 }
        );
      }

      const { objectId, ipfsHash, account, batchNumber, transactionDigest } = validation;

      // Ensure nfts table exists with correct schema
      await pool.query(`
        CREATE TABLE IF NOT EXISTS nfts (
          id SERIAL PRIMARY KEY,
          name TEXT,
          batch_number VARCHAR(100),
          manufacture_date TIMESTAMPTZ,
          expiry_date TIMESTAMPTZ,
          description TEXT,
          image_url TEXT,
          certificate_url TEXT,
          status VARCHAR(50) DEFAULT 'minted',
          ipfs_hash TEXT,
          manufacturer_address VARCHAR(100),
          distributor_address VARCHAR(100),
          pharmacy_address VARCHAR(100),
          token_id VARCHAR(66),
          object_id VARCHAR(66),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Check if transaction_digest column exists
      let columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='nfts' AND column_name='transaction_digest'
      `);
      
      let hasTransactionDigestColumn = columnCheck.rows.length > 0;

      // Add transaction_digest column if it doesn't exist
      if (!hasTransactionDigestColumn) {
        try {
          await pool.query(`ALTER TABLE nfts ADD COLUMN transaction_digest VARCHAR(100)`);
          console.log('[save-nft] Added transaction_digest column');
          // Re-check after adding
          columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='nfts' AND column_name='transaction_digest'
          `);
          hasTransactionDigestColumn = columnCheck.rows.length > 0;
        } catch (alterError: any) {
          console.warn('[save-nft] Could not add transaction_digest column:', alterError.message);
          // Column might already exist or there's a permission issue
          // Re-check to be sure
          columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='nfts' AND column_name='transaction_digest'
          `);
          hasTransactionDigestColumn = columnCheck.rows.length > 0;
        }
      }

      // Create index if not exists
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_nfts_object_id ON nfts(object_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_nfts_token_id ON nfts(token_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_nfts_batch_number ON nfts(batch_number)`);
      
      if (hasTransactionDigestColumn) {
        try {
          await pool.query(`CREATE INDEX IF NOT EXISTS idx_nfts_transaction_digest ON nfts(transaction_digest) WHERE transaction_digest IS NOT NULL`);
        } catch (indexError: any) {
          console.warn('[save-nft] Could not create transaction_digest index:', indexError.message);
        }
      }

      // Try to fetch actual object ID from transaction if we have transaction digest
      // This handles the case where client couldn't fetch it immediately after mint
      let actualObjectId = objectId;
      
      if (transactionDigest) {
        console.log('[save-nft] Object ID appears to be placeholder, trying to fetch from transaction...');
        try {
          const { SuiClient } = await import('@mysten/sui.js/client');
          const { getSuiRpcUrl } = await import('@/lib/blockchain/config-sui');
          
          const rpcUrl = getSuiRpcUrl();
          const client = new SuiClient({ url: rpcUrl });
          
          // Wait a bit for transaction to be indexed
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const txInfo = await client.getTransactionBlock({
            digest: transactionDigest,
            options: {
              showObjectChanges: true,
            },
          });

          const createdObjects = txInfo.objectChanges?.filter(
            (change: any) => change.type === 'created'
          ) || [];

          const nftObject = createdObjects.find((obj: any) => 
            obj.objectType?.includes('PharmaNFT') || 
            obj.objectType?.includes('pharma_nft')
          );

          if (nftObject?.objectId) {
            actualObjectId = nftObject.objectId;
            console.log('[save-nft] Successfully fetched object ID from transaction:', actualObjectId);
          }
        } catch (fetchError: any) {
          console.warn('[save-nft] Could not fetch object ID from transaction:', fetchError.message);
          // Continue with placeholder - can be updated later
        }
      }

      // Check if NFT with this object_id OR batch_number already exists
      const existingCheck = await pool.query(
        `SELECT id, object_id, batch_number, transaction_digest FROM nfts
         WHERE object_id = $1 OR token_id = $1 OR batch_number = $2 LIMIT 1`,
        [actualObjectId, batchNumber]
      );

      let result;
      const now = new Date().toISOString();

      if (existingCheck.rows.length > 0) {
        // NFT already exists (by object_id OR batch_number), update it instead
        const existing = existingCheck.rows[0];
        console.log('[save-nft] NFT already exists (by object_id or batch_number), updating:', existing.id);

        // Build update query
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;

        updateFields.push(`updated_at = $${paramIndex++}`);
        updateValues.push(now);

        // Update object_id and token_id if provided
        if (actualObjectId) {
          updateFields.push(`object_id = $${paramIndex++}`);
          updateValues.push(actualObjectId);
          updateFields.push(`token_id = $${paramIndex++}`);
          updateValues.push(actualObjectId);
        }

        // Update ipfs_hash if provided
        if (ipfsHash) {
          updateFields.push(`ipfs_hash = $${paramIndex++}`);
          updateValues.push(ipfsHash);
        }

        // Update status to minted
        updateFields.push(`status = $${paramIndex++}`);
        updateValues.push('minted');

        // Only add transaction_digest if column exists
        if (hasTransactionDigestColumn && transactionDigest) {
          updateFields.push(`transaction_digest = $${paramIndex++}`);
          updateValues.push(transactionDigest);
        }

        updateValues.push(existing.id); // For WHERE clause

        result = await pool.query(
          `UPDATE nfts
           SET ${updateFields.join(', ')}
           WHERE id = $${paramIndex}
           RETURNING *`,
          updateValues
        );

        console.log('[save-nft] NFT updated successfully, id:', result.rows[0]?.id);
      } else {
        // New NFT, insert it
        console.log('[save-nft] Inserting new NFT with:', {
          objectId: actualObjectId,
          ipfsHash,
          account: account.toLowerCase(),
          batchNumber,
          transactionDigest,
        });

        // Build insert query - include transaction_digest only if column exists
        if (hasTransactionDigestColumn) {
          result = await pool.query(
            `INSERT INTO nfts (name, status, created_at, manufacturer_address, ipfs_hash, batch_number, token_id, object_id, transaction_digest)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [
              `NFT-${batchNumber}`,
              'minted',
              now,
              account.toLowerCase(),
              ipfsHash,
              batchNumber,
              actualObjectId,
              actualObjectId,
              transactionDigest || null,
            ]
          );
        } else {
          // Insert without transaction_digest column
          result = await pool.query(
            `INSERT INTO nfts (name, status, created_at, manufacturer_address, ipfs_hash, batch_number, token_id, object_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [
              `NFT-${batchNumber}`,
              'minted',
              now,
              account.toLowerCase(),
              ipfsHash,
              batchNumber,
              actualObjectId,
              actualObjectId,
            ]
          );
        }
        
        console.log('[save-nft] NFT inserted successfully:', JSON.stringify(result.rows[0], null, 2));
      }

      console.log('[save-nft] NFT saved successfully:', result.rows[0]?.id);
      console.log('[save-nft] NFT full data:', JSON.stringify(result.rows[0], null, 2));
      const nft = result.rows[0];

    // Emit socket event for real-time update
    try {
      emitNFTMinted({
        objectId,
        batchNumber,
        manufacturerAddress: account,
        transactionDigest,
      });
    } catch (socketError) {
      console.error("Failed to emit socket event:", socketError);
    }

    return NextResponse.json({
      success: true,
      message: 'NFT đã được lưu vào database thành công!',
      nft,
      transactionDigest,
    });
  } catch (error: any) {
    console.error('[save-nft] Error saving NFT:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack?.substring(0, 500),
    });
    
    // Provide more specific error messages
    let errorMessage = 'Lỗi khi lưu NFT vào database';
    let statusCode = 500;
    
    if (error.code === '23505') { // Unique violation
      // This should not happen now since we handle duplicates, but just in case
      errorMessage = 'NFT với object ID này đã tồn tại trong database. Đã được xử lý tự động.';
      statusCode = 200; // Return success since we handle it
    } else if (error.code === '23503') { // Foreign key violation
      errorMessage = 'Dữ liệu không hợp lệ: thiếu thông tin liên quan';
    } else if (error.code === '42P01') { // Table doesn't exist
      errorMessage = 'Bảng database chưa được tạo. Vui lòng chạy migration.';
    } else if (error.message?.includes('column') || error.code === '42703') {
      // Column doesn't exist - this should be handled, but if it still fails, provide helpful message
      errorMessage = `Lỗi database schema: ${error.message}. Vui lòng chạy migration để tạo column cần thiết.`;
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
        detail: error.message || String(error),
        code: error.code,
      },
      { status: statusCode }
    );
    }
  });
}

// Apply rate limiting
export const POST = withRateLimit(handlePOST, rateLimitConfigs.write);

