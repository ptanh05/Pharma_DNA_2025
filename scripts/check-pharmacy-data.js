/**
 * Script kiểm tra dữ liệu pharmacy trong database
 * Chạy: node scripts/check-pharmacy-data.js
 */

const { Pool } = require('pg');
require('dotenv').config();

async function checkPharmacyData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Checking pharmacy data...\n');

    // 1. Kiểm tra tổng số NFTs
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM nfts');
    console.log(`📦 Total NFTs in database: ${totalResult.rows[0].total}`);

    // 2. Kiểm tra NFTs có pharmacy_address
    const pharmacyResult = await pool.query(
      `SELECT COUNT(*) as total FROM nfts WHERE pharmacy_address IS NOT NULL AND pharmacy_address != ''`
    );
    console.log(`🏥 NFTs with pharmacy_address: ${pharmacyResult.rows[0].total}`);

    // 3. Liệt kê các pharmacy_address
    const addressesResult = await pool.query(
      `SELECT DISTINCT pharmacy_address, COUNT(*) as count
       FROM nfts
       WHERE pharmacy_address IS NOT NULL AND pharmacy_address != ''
       GROUP BY pharmacy_address`
    );
    console.log('\n📋 Pharmacy addresses:');
    addressesResult.rows.forEach(row => {
      console.log(`  - ${row.pharmacy_address}: ${row.count} NFTs`);
    });

    // 4. Lấy 5 NFTs mẫu
    const sampleResult = await pool.query(
      `SELECT id, name, batch_number, status, pharmacy_address, created_at
       FROM nfts
       WHERE pharmacy_address IS NOT NULL AND pharmacy_address != ''
       LIMIT 5`
    );
    console.log('\n📄 Sample NFTs:');
    sampleResult.rows.forEach(row => {
      console.log(`  - ID: ${row.id}, Batch: ${row.batch_number}, Status: ${row.status}`);
      console.log(`    Pharmacy: ${row.pharmacy_address}`);
    });

    // 5. Kiểm tra schema
    const columnsResult = await pool.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'nfts'
       ORDER BY ordinal_position`
    );
    console.log('\n🗂️  NFTs table columns:');
    columnsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkPharmacyData();
