#!/usr/bin/env tsx
import { pool, closePool } from '@/lib/db';
import { readFileSync } from 'fs';
import { join } from 'path';

async function run() {
  const files = [
    'database/add_transaction_hash_column.sql',
    'database/add_missing_columns.sql',
  ];

  for (const file of files) {
    try {
      console.log(`Running: ${file}`);
      const sql = readFileSync(join(process.cwd(), file), 'utf8');
      await pool.query(sql);
      console.log(`  ✅ Done`);
    } catch (e: any) {
      if (e.code === '42701') {
        console.log(`  ⚠️  Column already exists (OK)`);
      } else {
        console.error(`  ❌ Error: ${e.message}`);
      }
    }
  }

  await closePool();
  console.log('\n✅ All migrations complete');
}

run().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
