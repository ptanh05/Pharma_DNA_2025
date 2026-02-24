/**
 * Database Optimization - Indexes & Queries
 * Tạo indexes để tăng tốc độ queries
 */

import { pool }from '@/lib/db/connection';
import { logInfo, logError }from '@/lib/logger';

/**
 * Create all necessary indexes
 */
export async function createIndexes() {
  const indexes = [
    // NFTs table indexes
    {
      name: 'idx_nfts_batch_number',
      sql: 'CREATE INDEX IF NOT EXISTS idx_nfts_batch_number ON nfts(batch_number)',
      table: 'nfts',
    },
    {
      name: 'idx_nfts_status',
      sql: 'CREATE INDEX IF NOT EXISTS idx_nfts_status ON nfts(status)',
      table: 'nfts',
    },
    {
      name: 'idx_nfts_manufacturer',
      sql: 'CREATE INDEX IF NOT EXISTS idx_nfts_manufacturer ON nfts(manufacturer_address)',
      table: 'nfts',
    },
    {
      name: 'idx_nfts_distributor',
      sql: 'CREATE INDEX IF NOT EXISTS idx_nfts_distributor ON nfts(distributor_address)',
      table: 'nfts',
    },
    {
      name: 'idx_nfts_pharmacy',
      sql: 'CREATE INDEX IF NOT EXISTS idx_nfts_pharmacy ON nfts(pharmacy_address)',
      table: 'nfts',
    },
    {
      name: 'idx_nfts_created_at',
      sql: 'CREATE INDEX IF NOT EXISTS idx_nfts_created_at ON nfts(created_at DESC)',
      table: 'nfts',
    },
    {
      name: 'idx_nfts_status_pharmacy',
      sql: 'CREATE INDEX IF NOT EXISTS idx_nfts_status_pharmacy ON nfts(pharmacy_address, status)',
      table: 'nfts',
    },

    // Users table indexes
    {
      name: 'idx_users_address',
      sql: 'CREATE INDEX IF NOT EXISTS idx_users_address ON users(address)',
      table: 'users',
    },
    {
      name: 'idx_users_role',
      sql: 'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
      table: 'users',
    },
    {
      name: 'idx_users_created_at',
      sql: 'CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC)',
      table: 'users',
    },

    // Dispensing records indexes
    {
      name: 'idx_dispensing_nft',
      sql: 'CREATE INDEX IF NOT EXISTS idx_dispensing_nft ON dispensing_records(nft_id)',
      table: 'dispensing_records',
    },
    {
      name: 'idx_dispensing_pharmacy',
      sql: 'CREATE INDEX IF NOT EXISTS idx_dispensing_pharmacy ON dispensing_records(pharmacy_address)',
      table: 'dispensing_records',
    },
    {
      name: 'idx_dispensing_customer',
      sql: 'CREATE INDEX IF NOT EXISTS idx_dispensing_customer ON dispensing_records(customer_id)',
      table: 'dispensing_records',
    },
    {
      name: 'idx_dispensing_dispensed_at',
      sql: 'CREATE INDEX IF NOT EXISTS idx_dispensing_dispensed_at ON dispensing_records(dispensed_at DESC)',
      table: 'dispensing_records',
    },

    // Transaction recovery log indexes
    {
      name: 'idx_tx_recovery_key',
      sql: 'CREATE INDEX IF NOT EXISTS idx_tx_recovery_key ON tx_recovery_log(idempotency_key)',
      table: 'tx_recovery_log',
    },
    {
      name: 'idx_tx_recovery_status',
      sql: 'CREATE INDEX IF NOT EXISTS idx_tx_recovery_status ON tx_recovery_log(status)',
      table: 'tx_recovery_log',
    },
    {
      name: 'idx_tx_recovery_created',
      sql: 'CREATE INDEX IF NOT EXISTS idx_tx_recovery_created ON tx_recovery_log(created_at DESC)',
      table: 'tx_recovery_log',
    },

    // Contract upgrades indexes
    {
      name: 'idx_contract_version',
      sql: 'CREATE INDEX IF NOT EXISTS idx_contract_version ON contract_versions(version)',
      table: 'contract_versions',
    },
    {
      name: 'idx_contract_status',
      sql: 'CREATE INDEX IF NOT EXISTS idx_contract_status ON contract_upgrades(status)',
      table: 'contract_upgrades',
    },
  ];

  logInfo('Creating database indexes');

  for (const index of indexes) {
    try {
      await pool.query(index.sql);
      logInfo(`Index created: ${index.name}`);
    }catch (error: any) {
      if (!error.message.includes('already exists')) {
        logError(`Failed to create index ${index.name}`, error);
      }
    }
  }

  logInfo('Database indexes creation complete');
}

/**
 * Get query statistics
 */
export async function getQueryStats() {
  const stats = await pool.query(`
    SELECT
      query,
      calls,
      mean_exec_time,
      max_exec_time,
      stddev_exec_time
    FROM pg_stat_statements
    WHERE query NOT LIKE '%pg_stat_statements%'
    ORDER BY mean_exec_time DESC
    LIMIT 20
  `);

  return stats.rows;
}

/**
 * Get missing indexes recommendations
 */
export async function getMissingIndexes() {
  const missing = await pool.query(`
    SELECT
      schemaname,
      tablename,
      attname,
      n_distinct,
      correlation
    FROM pg_stats
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    AND n_distinct > 100
    AND correlation < 0.1
    ORDER BY n_distinct DESC
    LIMIT 20
  `);

  return missing.rows;
}

/**
 * Analyze table for query optimization
 */
export async function analyzeTables() {
  const tables = [
    'nfts',
    'users',
    'dispensing_records',
    'tx_recovery_log',
    'contract_versions',
    'contract_upgrades',
  ];

  logInfo('Analyzing tables for query optimization');

  for (const table of tables) {
    try {
      await pool.query(`ANALYZE ${table}`);
      logInfo(`Table analyzed: ${table}`);
    }catch (error) {
      logError(`Failed to analyze table ${table}`, error);
    }
  }

  logInfo('Table analysis complete');
}

/**
 * Vacuum tables to reclaim space
 */
export async function vacuumTables() {
  const tables = [
    'nfts',
    'users',
    'dispensing_records',
    'tx_recovery_log',
  ];

  logInfo('Vacuuming tables');

  for (const table of tables) {
    try {
      await pool.query(`VACUUM ANALYZE ${table}`);
      logInfo(`Table vacuumed: ${table}`);
    }catch (error) {
      logError(`Failed to vacuum table ${table}`, error);
    }
  }

  logInfo('Table vacuum complete');
}

/**
 * Run all optimization tasks
 */
export async function runOptimizations() {
  try {
    logInfo('Running database optimizations');
    
    await createIndexes();
    await analyzeTables();

    logInfo('Database optimizations complete');
  }catch (error) {
    logError('Database optimizations failed', error);
    throw error;
  }
}
