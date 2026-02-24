#!/usr/bin/env tsx
/**
 * Database Migration Script
 * Initialize and seed database for production
 */

import { pool } from '@/lib/db';
import { runMigrations }from '@/lib/db/migrations';

async function main() {
  console.log('🚀 Starting database migration...\n');

  try {
    // Run all migrations
    await runMigrations();

    console.log('\n✅ Database migration completed successfully\n');
    process.exit(0);
  }catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
