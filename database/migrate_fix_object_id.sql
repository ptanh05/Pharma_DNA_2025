/**
 * Migration: Fix object_id for NFTs that stored batch_number instead of real Sui object ID
 *
 * Problem: Earlier NFTs had batch_number (e.g. "LOT202506AW") stored in object_id column
 *          instead of the real Sui object ID (0x...).
 * Fix:    Query blockchain to find the real object_id using batch_number + manufacturer_address
 *
 * Run:  POST /api/migrate/fix-object-id
 * Or:  npx tsx database/migrate_fix_object_id.ts
 */

-- Step 1: Preview - xem những NFT nào bị ảnh hưởng (chạy trước)
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
ORDER BY created_at DESC;

-- Step 2: Count affected rows
SELECT COUNT(*) as affected_count
FROM nfts
WHERE
  (object_id IS NULL OR object_id = '' OR object_id NOT LIKE '0x%')
  AND batch_number IS NOT NULL
  AND batch_number != '';
