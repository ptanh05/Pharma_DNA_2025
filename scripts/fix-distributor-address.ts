#!/usr/bin/env tsx
/**
 * Fix distributor addresses in transfer_requests_v2
 * The distributor wrongly used MANUFACTURER wallet instead of DISTRIBUTOR wallet
 * Run: npx tsx --tsconfig tsconfig.json scripts/fix-distributor-address.ts
 * Or:  npx tsx scripts/fix-distributor-address.ts
 */
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

const CORRECT_DISTRIBUTOR = '0xde59145795998229fd3eee3756d97d0e4b5200894c6f5aa59a5974509f28d2e6';
const WRONG_ADDRESS = '0x174a43ffabe53872a9f1a41be51033026aad4d1d4ab4f5f4de8b4ce6d62f1516';

async function main() {
  console.log('🔧 Fixing distributor_address in transfer_requests_v2...\n');
  console.log(`Wrong address:   ${WRONG_ADDRESS}`);
  console.log(`Correct address: ${CORRECT_DISTRIBUTOR}\n`);

  // Show current pending requests
  const before = await pool.query(
    'SELECT id, nft_id, distributor_address FROM transfer_requests_v2 WHERE status = $1',
    ['pending']
  );
  console.log('Before:');
  before.rows.forEach(r => console.log(`  id=${r.id} nft=${r.nft_id} dist=${r.distributor_address}`));

  // Update pending requests with wrong distributor address
  const result = await pool.query(
    `UPDATE transfer_requests_v2
     SET distributor_address = $1, updated_at = NOW()
     WHERE distributor_address = $2 AND status = 'pending'
     RETURNING id, nft_id, distributor_address`,
    [CORRECT_DISTRIBUTOR, WRONG_ADDRESS]
  );
  console.log(`\n✅ Updated ${result.rowCount} rows in transfer_requests_v2:`);
  result.rows.forEach(r => console.log(`  id=${r.id} nft=${r.nft_id} → ${r.distributor_address}`));

  // Also fix original transfer_requests table if it exists
  try {
    const result2 = await pool.query(
      `UPDATE transfer_requests
       SET distributor_address = $1, updated_at = NOW()
       WHERE distributor_address = $2 AND status = 'pending'
       RETURNING id, nft_id, distributor_address`,
      [CORRECT_DISTRIBUTOR, WRONG_ADDRESS]
    );
    if (result2.rowCount && result2.rowCount > 0) {
      console.log(`\n✅ Updated ${result2.rowCount} rows in transfer_requests:`);
      result2.rows.forEach(r => console.log(`  id=${r.id} nft=${r.nft_id} → ${r.distributor_address}`));
    }
  } catch (e: any) {
    if (!e.message?.includes('does not exist')) {
      console.error('transfer_requests error:', e.message);
    }
  }

  console.log('\n✨ All done!');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
