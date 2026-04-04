/**
 * Shared database table initialization
 * Ensures required tables exist before use (runs once per process)
 * Source of truth: synced with /api/migrate endpoint
 *
 * Handles:
 * - CREATE TABLE IF NOT EXISTS (new tables)
 * - ALTER TABLE ADD COLUMN IF NOT EXISTS (missing columns on existing tables)
 */

import { pool } from '@/lib/db';

const initializedTables = new Set<string>();

/**
 * Ensure a column exists on a table. Safe to call on any table.
 */
async function ensureColumn(tableName: string, columnDef: string): Promise<void> {
  // Parse "column_name TYPE" from definitions like "column_name TYPE DEFAULT value"
  const match = columnDef.match(/^(\w+)\s+(.+)$/);
  if (!match) return;
  const [, columnName, rest] = match;

  // Extract type only (strip DEFAULT, CHECK, etc.)
  const typeOnly = rest
    .replace(/\s+DEFAULT\s+.+$/i, '')
    .replace(/\s+CHECK\s*\([^)]+\)/i, '')
    .replace(/\s+UNIQUE\s+NOT\s+NULL/i, ' UNIQUE NOT NULL')
    .replace(/\s+NOT\s+NULL/i, ' NOT NULL')
    .trim();

  try {
    await pool.query(
      `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnName} ${typeOnly}`
    );
  } catch (e: any) {
    // Column may already exist or unsupported — log and continue
    if (!e.message?.includes('already exists')) {
      console.warn(`[DB Init] ${tableName}.${columnName}: ${e.message}`);
    }
  }
}

export async function ensureTableExists(tableName: string, createSQL: string): Promise<void> {
  if (initializedTables.has(tableName)) return;

  try {
    // Step 1: CREATE TABLE IF NOT EXISTS
    await pool.query(createSQL);

    // Step 2: ADD MISSING COLUMNS on existing table
    // Extract column definitions from CREATE TABLE SQL
    // Format: column_name TYPE [DEFAULT ...] [CHECK ...] [NOT NULL]
    const columnMatches = createSQL.matchAll(/^\s{6}(\w+)\s+(.+?),?\s*$/gm);
    for (const match of columnMatches) {
      const columnName = match[1];
      const def = match[2].replace(/,\s*$/, '').trim();
      // Skip primary key / special constraints
      if (columnName === 'id' || def.toUpperCase().includes('PRIMARY KEY')) continue;
      await ensureColumn(tableName, `${columnName} ${def}`);
    }

    initializedTables.add(tableName);
  } catch (error) {
    // Table may already exist with different definition - log and continue
    console.warn(`[DB Init] Table ${tableName} init error:`, (error as Error).message);
    initializedTables.add(tableName);
  }
}

// SQL for each table — synced with /api/migrate
export const TABLE_DEFINITIONS: Record<string, string> = {
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      address VARCHAR(255) UNIQUE NOT NULL,
      role VARCHAR(50) CHECK (role IN ('ADMIN','MANUFACTURER','DISTRIBUTOR','PHARMACY')),
      assigned_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      blockchain_synced BOOLEAN DEFAULT FALSE,
      blockchain_tx VARCHAR(255),
      blockchain_error TEXT,
      last_sync_attempt TIMESTAMPTZ
    )
  `,
  nfts: `
    CREATE TABLE IF NOT EXISTS nfts (
      id SERIAL PRIMARY KEY,
      name TEXT,
      batch_number VARCHAR(100),
      manufacture_date TIMESTAMPTZ,
      expiry_date TIMESTAMPTZ,
      description TEXT,
      image_url TEXT,
      certificate_url TEXT,
      status VARCHAR(50) DEFAULT 'minted',
      ipfs_hash TEXT,
      manufacturer_address VARCHAR(100),
      distributor_address VARCHAR(100),
      pharmacy_address VARCHAR(100),
      token_id VARCHAR(66),
      object_id VARCHAR(66),
      transaction_digest VARCHAR(100),
      transaction_hash VARCHAR(255),
      quantity INTEGER DEFAULT 1,
      last_dispensed_at TIMESTAMPTZ,
      receipt_confirmed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  milestones: `
    CREATE TABLE IF NOT EXISTS milestones (
      id SERIAL PRIMARY KEY,
      nft_id INTEGER,
      type VARCHAR(100),
      description TEXT,
      location TEXT,
      actor_address VARCHAR(100),
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  transfer_requests: `
    CREATE TABLE IF NOT EXISTS transfer_requests (
      id SERIAL PRIMARY KEY,
      nft_id INTEGER,
      distributor_address VARCHAR(100),
      pharmacy_address VARCHAR(100),
      status VARCHAR(50) DEFAULT 'pending',
      object_id VARCHAR(66),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  transfer_requests_v2: `
    CREATE TABLE IF NOT EXISTS transfer_requests_v2 (
      id SERIAL PRIMARY KEY,
      nft_id INTEGER NOT NULL,
      distributor_address VARCHAR(100),
      pharmacy_address VARCHAR(100),
      quantity INTEGER DEFAULT 1,
      transfer_note TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  notifications: `
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255),
      type VARCHAR(50),
      title TEXT,
      message TEXT,
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  agent_audit_logs: `
    CREATE TABLE IF NOT EXISTS agent_audit_logs (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255),
      tool VARCHAR(100),
      action TEXT,
      result VARCHAR(50),
      error TEXT,
      metadata JSONB,
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  tx_recovery_log: `
    CREATE TABLE IF NOT EXISTS tx_recovery_log (
      id SERIAL PRIMARY KEY,
      idempotency_key VARCHAR(500) UNIQUE NOT NULL,
      result JSONB,
      status VARCHAR(20) NOT NULL,
      error_message TEXT,
      error_stack TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  dispensing_records: `
    CREATE TABLE IF NOT EXISTS dispensing_records (
      id VARCHAR(100) PRIMARY KEY,
      nft_id INTEGER,
      pharmacy_address VARCHAR(100),
      customer_id VARCHAR(255),
      quantity INTEGER DEFAULT 1,
      prescription_id VARCHAR(255),
      dispensed_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  webhooks: `
    CREATE TABLE IF NOT EXISTS webhooks (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255),
      url TEXT NOT NULL,
      events JSONB NOT NULL,
      secret VARCHAR(255),
      enabled BOOLEAN DEFAULT true,
      headers JSONB,
      retry_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  webhook_events: `
    CREATE TABLE IF NOT EXISTS webhook_events (
      id VARCHAR(100) PRIMARY KEY,
      webhook_id INTEGER,
      event VARCHAR(100) NOT NULL,
      payload JSONB NOT NULL,
      status VARCHAR(20) NOT NULL,
      attempts INTEGER DEFAULT 0,
      last_attempt TIMESTAMP,
      response JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  role_registrations: `
    CREATE TABLE IF NOT EXISTS role_registrations (
      id SERIAL PRIMARY KEY,
      wallet_address VARCHAR(100) NOT NULL,
      requested_role VARCHAR(20) NOT NULL CHECK (requested_role IN ('MANUFACTURER', 'DISTRIBUTOR', 'PHARMACY')),
      company_name TEXT,
      license_number TEXT,
      license_ipfs_hash TEXT,
      tax_id TEXT,
      distributor_name TEXT,
      distributor_address TEXT,
      pharmacy_name TEXT,
      pharmacy_address TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      notes TEXT,
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      reviewed_by VARCHAR(100),
      reviewed_at TIMESTAMPTZ,
      rejection_reason TEXT,
      blockchain_tx VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  onchain_proposals: `
    CREATE TABLE IF NOT EXISTS onchain_proposals (
      id SERIAL PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      proposal_data JSONB NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_by VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      executed_at TIMESTAMPTZ,
      transaction_digest VARCHAR(255)
    )
  `,
  quality_alerts: `
    CREATE TABLE IF NOT EXISTS quality_alerts (
      id SERIAL PRIMARY KEY,
      nft_id INTEGER,
      batch_number VARCHAR(100),
      severity VARCHAR(20) DEFAULT 'warning',
      alert_type VARCHAR(50),
      description TEXT,
      location VARCHAR(255),
      resolved BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  sensor_data: `
    CREATE TABLE IF NOT EXISTS sensor_data (
      id SERIAL PRIMARY KEY,
      nft_id INTEGER,
      temperature DECIMAL(5,2),
      humidity DECIMAL(5,2),
      gps_lat DECIMAL(10,7),
      gps_lng DECIMAL(10,7),
      gps_location TEXT,
      recorded_at TIMESTAMPTZ,
      distributor_address VARCHAR(100),
      raw_data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  contract_versions: `
    CREATE TABLE IF NOT EXISTS contract_versions (
      id SERIAL PRIMARY KEY,
      version VARCHAR(50) NOT NULL,
      package_id TEXT,
      description TEXT,
      deployed_at TIMESTAMPTZ DEFAULT NOW(),
      deployed_by VARCHAR(100),
      tx_digest VARCHAR(255),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  contract_upgrades: `
    CREATE TABLE IF NOT EXISTS contract_upgrades (
      id SERIAL PRIMARY KEY,
      version VARCHAR(50) NOT NULL,
      previous_version VARCHAR(50),
      migration_script TEXT,
      description TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      initiated_by VARCHAR(100),
      tx_digest VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `,
  issues: `
    CREATE TABLE IF NOT EXISTS issues (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255),
      description TEXT,
      severity VARCHAR(20) DEFAULT 'medium',
      status VARCHAR(20) DEFAULT 'open',
      created_by VARCHAR(100),
      assigned_to VARCHAR(100),
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  workflows: `
    CREATE TABLE IF NOT EXISTS workflows (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      task TEXT NOT NULL,
      schedule VARCHAR(100) NOT NULL,
      enabled BOOLEAN DEFAULT true,
      last_run TIMESTAMP,
      next_run TIMESTAMP,
      run_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      context JSONB,
      created_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `,
  workflow_executions: `
    CREATE TABLE IF NOT EXISTS workflow_executions (
      id SERIAL PRIMARY KEY,
      workflow_id INTEGER,
      status VARCHAR(20) NOT NULL,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      result JSONB,
      error TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `,
  learning_patterns: `
    CREATE TABLE IF NOT EXISTS learning_patterns (
      id SERIAL PRIMARY KEY,
      pattern_type VARCHAR(20) NOT NULL,
      context JSONB,
      action TEXT NOT NULL,
      result JSONB,
      performance DECIMAL(3,2) DEFAULT 0,
      frequency INTEGER DEFAULT 1,
      last_seen TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `,
  adaptation_rules: `
    CREATE TABLE IF NOT EXISTS adaptation_rules (
      id SERIAL PRIMARY KEY,
      condition JSONB NOT NULL,
      action TEXT NOT NULL,
      priority INTEGER DEFAULT 1,
      enabled BOOLEAN DEFAULT true,
      success_rate DECIMAL(3,2) DEFAULT 0,
      usage_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `,
  agent_memory: `
    CREATE TABLE IF NOT EXISTS agent_memory (
      session_id VARCHAR(100) PRIMARY KEY,
      messages JSONB,
      context JSONB,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    )
  `,
  token_usage: `
    CREATE TABLE IF NOT EXISTS token_usage (
      id SERIAL PRIMARY KEY,
      model VARCHAR(50) NOT NULL,
      prompt_tokens INTEGER NOT NULL,
      completion_tokens INTEGER NOT NULL,
      total_tokens INTEGER NOT NULL,
      cost DECIMAL(10,6) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `,
};
