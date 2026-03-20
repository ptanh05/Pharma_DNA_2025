#!/usr/bin/env tsx
import { pool, closePool } from '@/lib/db';

async function verify() {
  const res = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'nfts'
    ORDER BY ordinal_position
  `);
  console.log('=== nfts columns ===');
  for (const r of res.rows) {
    console.log(`  ${r.column_name.padEnd(28)} ${r.data_type.padEnd(20)} ${r.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
  }

  const res2 = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'transfer_requests'
    ORDER BY ordinal_position
  `);
  console.log('\n=== transfer_requests columns ===');
  for (const r of res2.rows) {
    console.log(`  ${r.column_name}`);
  }

  const res3 = await pool.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'nfts' ORDER BY indexname
  `);
  console.log('\n=== nfts indexes ===');
  for (const r of res3.rows) {
    console.log(`  ${r.indexname}`);
  }

  const res4 = await pool.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'transfer_requests' ORDER BY indexname
  `);
  console.log('\n=== transfer_requests indexes ===');
  for (const r of res4.rows) {
    console.log(`  ${r.indexname}`);
  }

  await closePool();
}

verify().catch(e => { console.error(e.message); process.exit(1); });
