/**
 * Migration: Recreate nfts view/table với address columns lớn hơn
 * Chạy: node scripts/recreate-nfts-v3.js
 */

const { Pool } = require('pg');
require('dotenv').config();

async function recreateNfts() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    console.log('🔧 Recreating nfts...\n');

    // Check if it's a view or table
    const checkResult = await pool.query(`
      SELECT table_type
      FROM information_schema.tables
      WHERE table_name = 'nfts'
    `);

    if (checkResult.rows.length > 0) {
      const type = checkResult.rows[0].table_type;
      console.log(`📋 Current nfts is a: ${type}`);

      // Backup data first
      console.log('\n📦 Backing up existing data...');
      const backupResult = await pool.query('SELECT * FROM nfts');
      console.log(`✅ Backed up ${backupResult.rows.length} rows`);

      // Drop view or table
      if (type === 'VIEW') {
        console.log('\n🗑️  Dropping view...');
        await pool.query('DROP VIEW IF EXISTS nfts CASCADE');
      } else {
        console.log('\n🗑️  Dropping table...');
        await pool.query('DROP TABLE IF EXISTS nfts CASCADE');
      }
      console.log('✅ Dropped successfully');

      // Create new table
      console.log('\n🆕 Creating new table...');
      await pool.query(`
        CREATE TABLE nfts (
          id SERIAL PRIMARY KEY,
          token_id BIGINT,
          batch_number VARCHAR(100),
          name VARCHAR(255),
          manufacturer_address VARCHAR(100),
          manufacture_date DATE,
          expiry_date DATE,
          quantity INTEGER,
          unit VARCHAR(50),
          ipfs_hash VARCHAR(255),
          distributor_address VARCHAR(100),
          pharmacy_address VARCHAR(100),
          image_url TEXT,
          status VARCHAR(50),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('✅ New table created');

      // Restore data
      if (backupResult.rows.length > 0) {
        console.log('\n📥 Restoring data...');
        for (const row of backupResult.rows) {
          await pool.query(
            `INSERT INTO nfts (
              id, token_id, batch_number, name, manufacturer_address,
              manufacture_date, expiry_date, quantity, unit, ipfs_hash,
              distributor_address, pharmacy_address, image_url, status,
              created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
            [
              row.id, row.token_id, row.batch_number, row.name, row.manufacturer_address,
              row.manufacture_date, row.expiry_date, row.quantity, row.unit, row.ipfs_hash,
              row.distributor_address, row.pharmacy_address, row.image_url, row.status,
              row.created_at, row.updated_at
            ]
          );
        }
        console.log(`✅ Restored ${backupResult.rows.length} rows`);

        // Reset sequence
        await pool.query(`SELECT setval('nfts_id_seq', (SELECT MAX(id) FROM nfts))`);
        console.log('✅ Sequence reset');
      }

      console.log('\n🎉 Successfully recreated nfts table!');
      console.log('📋 Address columns now support VARCHAR(100)');
    } else {
      console.log('❌ nfts does not exist');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

recreateNfts();
