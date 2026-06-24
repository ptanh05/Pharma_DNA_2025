/**
 * Migration: Tăng kích thước address columns (cách 2)
 * Chạy: node scripts/fix-address-column-v2.js
 */

const { Pool } = require('pg');
require('dotenv').config();

async function fixAddressColumns() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    console.log('🔧 Fixing address column lengths (method 2)...\n');

    // Kiểm tra column hiện tại
    const checkResult = await pool.query(`
      SELECT column_name, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'nfts'
      AND column_name IN ('manufacturer_address', 'distributor_address', 'pharmacy_address')
    `);

    console.log('📋 Current column lengths:');
    checkResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.character_maximum_length}`);
    });

    // Thử ALTER với USING clause
    console.log('\n🔄 Attempting to alter columns...');

    const alterQueries = [
      `ALTER TABLE nfts ALTER COLUMN manufacturer_address TYPE VARCHAR(100) USING manufacturer_address::VARCHAR(100)`,
      `ALTER TABLE nfts ALTER COLUMN distributor_address TYPE VARCHAR(100) USING distributor_address::VARCHAR(100)`,
      `ALTER TABLE nfts ALTER COLUMN pharmacy_address TYPE VARCHAR(100) USING pharmacy_address::VARCHAR(100)`,
    ];

    for (const query of alterQueries) {
      try {
        await pool.query(query);
        console.log(`✅ Updated column successfully`);
      } catch (err) {
        console.log(`⚠️  ${err.message}`);
      }
    }

    // Verify changes
    const verifyResult = await pool.query(`
      SELECT column_name, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'nfts'
      AND column_name IN ('manufacturer_address', 'distributor_address', 'pharmacy_address')
    `);

    console.log('\n📋 Updated column lengths:');
    verifyResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.character_maximum_length}`);
    });

    console.log('\n🎉 Done!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixAddressColumns();
