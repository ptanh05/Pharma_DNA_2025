/**
 * Migration: Add company info columns to users table
 * Run: npx tsx scripts/migrate-add-company-info.ts
 *
 * Requires DATABASE_URL in environment or .env file
 */

import * as dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import { pool } from '@/lib/db';

async function migrate() {
  console.log('🔄 Running migration: add company info to users table...');

  const columns = [
    { name: 'company_name', type: 'TEXT' },
    { name: 'license_number', type: 'TEXT' },
    { name: 'license_ipfs_hash', type: 'TEXT' },
    { name: 'tax_id', type: 'TEXT' },
    { name: 'contact_email', type: 'TEXT' },
    { name: 'contact_phone', type: 'TEXT' },
    { name: 'company_address', type: 'TEXT' },
    { name: 'notes', type: 'TEXT' },
  ];

  for (const col of columns) {
    try {
      await pool.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`
      );
      console.log(`✅ Added column: ${col.name}`);
    } catch (err: any) {
      if (err.code === '42701') {
        // Column already exists
        console.log(`⏭️  Column already exists: ${col.name}`);
      } else {
        console.error(`❌ Failed to add ${col.name}:`, err.message);
      }
    }
  }

  console.log('\n🎉 Migration complete!');
  await (pool as any).end?.();
}

migrate().catch(console.error);
