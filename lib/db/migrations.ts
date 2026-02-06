/**
 * Database Migrations
 * Initialize all required tables
 */

import { pool } from "@/lib/db";

/**
 * Create NFTs table
 */
export const createNFTsTable = `
  CREATE TABLE IF NOT EXISTS nfts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    batch_number VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'created',
    manufacturer_address VARCHAR(100) NOT NULL,
    distributor_address VARCHAR(100),
    pharmacy_address VARCHAR(100),
    object_id VARCHAR(255),
    token_id VARCHAR(255),
    ipfs_hash VARCHAR(255),
    expiry_date BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

/**
 * Create Transfer Requests table
 */
export const createTransferRequestsTable = `
  CREATE TABLE IF NOT EXISTS transfer_requests (
    id SERIAL PRIMARY KEY,
    nft_id INTEGER NOT NULL,
    distributor_address VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

/**
 * Create Milestones table
 */
export const createMilestonesTable = `
  CREATE TABLE IF NOT EXISTS milestones (
    id SERIAL PRIMARY KEY,
    nft_id INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    timestamp TIMESTAMPTZ NOT NULL,
    actor_address VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

/**
 * Create Users table
 */
export const createUsersTable = `
  CREATE TABLE IF NOT EXISTS users (
    address VARCHAR(100) PRIMARY KEY,
    role VARCHAR(50) NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

/**
 * Create On-chain Proposals table
 */
export const createProposalsTable = `
  CREATE TABLE IF NOT EXISTS onchain_proposals (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    proposal_data JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_at TIMESTAMPTZ,
    transaction_digest VARCHAR(255)
  );
`;

/**
 * Run all migrations
 */
export async function runMigrations(): Promise<void> {
  try {
    console.log("Starting database migrations...");

    await pool.query(createNFTsTable);
    console.log("✓ NFTs table created");

    await pool.query(createTransferRequestsTable);
    console.log("✓ Transfer Requests table created");

    await pool.query(createMilestonesTable);
    console.log("✓ Milestones table created");

    await pool.query(createUsersTable);
    console.log("✓ Users table created");

    await pool.query(createProposalsTable);
    console.log("✓ On-chain Proposals table created");

    console.log("✓ All migrations completed successfully");
  }catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

/**
 * Drop all tables (for testing)
 */
export async function dropAllTables(): Promise<void> {
  try {
    console.log("Dropping all tables...");

    await pool.query("DROP TABLE IF EXISTS milestones CASCADE");
    await pool.query("DROP TABLE IF EXISTS transfer_requests CASCADE");
    await pool.query("DROP TABLE IF EXISTS onchain_proposals CASCADE");
    await pool.query("DROP TABLE IF EXISTS users CASCADE");
    await pool.query("DROP TABLE IF EXISTS nfts CASCADE");

    console.log("✓ All tables dropped");
  } catch (error) {
    console.error("Drop tables failed:", error);
    throw error;
  }
}
