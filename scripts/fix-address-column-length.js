/**
 * Migration: Tăng kích thước address columns
 * Chạy: node scripts/fix-address-column-length.js
 */

const { Pool } = require('pg');
require('dotenv').config();

async function fixAddressColumns() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    console.log('🔧 Fixing address column lengths...\n');

    // Tăng kích thước các address columns từ VARCHAR(42) lên VARCHAR(100)
    const alterQueries = [
      'ALTER TABLE nfts ALTER COLUMN manufacturer_address TYPE VARCHAR(100)',
      'ALTER TABLE nfts ALTER COLUMN distributor_address TYPE VARCHAR(100)',
      'ALTER TABLE nfts ALTER COLUMN pharmacy_address TYPE VARCHAR(100)',
    ];

    for (const query of alterQueries) {
      await pool.query(query);
      console.log(`✅ ${query}`);
    }

    console.log('\n🎉 Successfully updated address columns to VARCHAR(100)!');
    console.log('📋 Now you can create NFTs with Sui addresses.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixAddressColumns();
