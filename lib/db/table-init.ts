/**
 * Shared database table initialization
 * Ensures required tables exist before use (runs once per process)
 */

import { pool } from '@/lib/db';

const initializedTables = new Set<string>();

export async function ensureTableExists(tableName: string, createSQL: string): Promise<void> {
  if (initializedTables.has(tableName)) return;

  try {
    await pool.query(createSQL);
    initializedTables.add(tableName);
  } catch (error) {
    // Table might already exist with different definition - log and continue
    console.warn(`[DB Init] Table ${tableName} may already exist:`, (error as Error).message);
    initializedTables.add(tableName);
  }
}

// SQL for each table
export const TABLE_DEFINITIONS: Record<string, string> = {
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      address VARCHAR(255) UNIQUE NOT NULL,
      role VARCHAR(50) CHECK (role IN ('ADMIN', 'MANUFACTURER', 'DISTRIBUTOR', 'PHARMACY')),
      assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `,
  milestones: `
    CREATE TABLE IF NOT EXISTS milestones (
      id SERIAL PRIMARY KEY,
      nft_id INTEGER,
      type VARCHAR(100),
      description TEXT,
      location VARCHAR(255),
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      actor_address VARCHAR(66),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  transfer_requests: `
    CREATE TABLE IF NOT EXISTS transfer_requests (
      id SERIAL PRIMARY KEY,
      nft_id INTEGER NOT NULL,
      distributor_address VARCHAR(66) NOT NULL,
      pharmacy_address VARCHAR(66),
      transfer_note TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
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
      manufacturer_address VARCHAR(66),
      distributor_address VARCHAR(66),
      pharmacy_address VARCHAR(66),
      token_id VARCHAR(66),
      object_id VARCHAR(66),
      transaction_hash VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  notifications: `
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      recipient_address VARCHAR(66),
      user_id VARCHAR(66),
      type VARCHAR(50),
      title VARCHAR(255),
      message TEXT,
      priority VARCHAR(20) DEFAULT 'medium',
      is_read BOOLEAN DEFAULT FALSE,
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  transfer_requests_v2: `
    CREATE TABLE IF NOT EXISTS transfer_requests_v2 (
      id SERIAL PRIMARY KEY,
      nft_id INTEGER NOT NULL,
      distributor_address VARCHAR(66) NOT NULL,
      pharmacy_address VARCHAR(66),
      quantity INTEGER DEFAULT 1,
      transfer_note TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
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
  agent_audit_logs: `
    CREATE TABLE IF NOT EXISTS agent_audit_logs (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255),
      agent_id VARCHAR(255),
      tool VARCHAR(255),
      action TEXT,
      request_data JSONB,
      response_data JSONB,
      result VARCHAR(50) CHECK (result IN ('success', 'failure', 'pending')),
      error TEXT,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `,
};
