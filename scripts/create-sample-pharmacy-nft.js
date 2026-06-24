/**
 * Script tạo NFT mẫu cho pharmacy address
 * Chạy: node scripts/create-sample-pharmacy-nft.js <pharmacy_address>
 */

const { Pool } = require('pg');
require('dotenv').config();

async function createSampleNFT() {
  const pharmacyAddress = process.argv[2];

  if (!pharmacyAddress) {
    console.error('❌ Usage: node scripts/create-sample-pharmacy-nft.js <pharmacy_address>');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    console.log(`🏥 Creating sample NFT for pharmacy: ${pharmacyAddress}\n`);

    // Tạo 3 NFTs mẫu
    const nfts = [
      {
        batch_number: `BATCH-${Date.now()}-001`,
        name: 'Paracetamol 500mg',
        status: 'at_pharmacy',
        quantity: 100,
        manufacturer_address: '0x1234567890abcdef1234567890abcdef12345678',
        distributor_address: '0x2234567890abcdef1234567890abcdef12345678',
      },
      {
        batch_number: `BATCH-${Date.now()}-002`,
        name: 'Amoxicillin 250mg',
        status: 'at_pharmacy',
        quantity: 50,
        manufacturer_address: '0x1234567890abcdef1234567890abcdef12345678',
        distributor_address: '0x2234567890abcdef1234567890abcdef12345678',
      },
      {
        batch_number: `BATCH-${Date.now()}-003`,
        name: 'Vitamin C 1000mg',
        status: 'dispensed',
        quantity: 0,
        manufacturer_address: '0x1234567890abcdef1234567890abcdef12345678',
        distributor_address: '0x2234567890abcdef1234567890abcdef12345678',
      },
    ];

    for (const nft of nfts) {
      const result = await pool.query(
        `INSERT INTO nfts (
          batch_number, name, status, quantity,
          manufacturer_address, distributor_address, pharmacy_address,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id, batch_number, name, status`,
        [
          nft.batch_number,
          nft.name,
          nft.status,
          nft.quantity,
          nft.manufacturer_address,
          nft.distributor_address,
          pharmacyAddress.toLowerCase(),
        ]
      );

      console.log(`✅ Created NFT #${result.rows[0].id}: ${result.rows[0].name} (${result.rows[0].batch_number})`);
    }

    console.log(`\n🎉 Successfully created ${nfts.length} sample NFTs!`);
    console.log(`\n📋 Now refresh your pharmacy page to see the data.`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

createSampleNFT();
