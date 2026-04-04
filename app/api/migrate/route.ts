import { NextRequest, NextResponse }from "next/server";
import { pool } from "@/lib/db";

/**
 * GET /api/migrate
 * Run all database migrations to ensure schema is correct.
 * Safe to run multiple times (idempotent).
 */
export async function GET(req: NextRequest) {
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(`[MIGRATE] ${msg}`);
    logs.push(msg);
  };

  try {
    // ─── 1. USERS TABLE ───────────────────────────────────────────────
    const usersExists = await tableExists("users");

    if (!usersExists) {
      await pool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          address VARCHAR(255) UNIQUE NOT NULL,
          role VARCHAR(50) CHECK (role IN ('ADMIN','MANUFACTURER','DISTRIBUTOR','PHARMACY')),
          assigned_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_address ON users(address)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_assigned_at ON users(assigned_at)`);
      log("Created users table with indexes");
    } else {
      // Table exists — ensure all required columns are present
      await ensureColumn("users", "id", "SERIAL PRIMARY KEY", log);
      await ensureColumn("users", "address", "VARCHAR(255) UNIQUE NOT NULL", log);
      await ensureColumn("users", "role", "VARCHAR(50)", log);
      await ensureColumn("users", "assigned_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      await ensureColumn("users", "updated_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      await ensureColumn("users", "created_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_address ON users(address)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
      log("users table verified / patched");
    }

    // ─── 2. NFTS TABLE ────────────────────────────────────────────────
    const nftsExists = await tableExists("nfts");

    if (!nftsExists) {
      await pool.query(`
        CREATE TABLE nfts (
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
          quantity INTEGER DEFAULT 1,
          last_dispensed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_nfts_object_id ON nfts(object_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_nfts_token_id ON nfts(token_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_nfts_batch_number ON nfts(batch_number)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_nfts_manufacturer ON nfts(manufacturer_address)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_nfts_status ON nfts(status)`);
      log("Created nfts table with indexes");
    }else {
      await ensureColumn("nfts", "id", "SERIAL PRIMARY KEY", log);
      await ensureColumn("nfts", "name", "TEXT", log);
      await ensureColumn("nfts", "batch_number", "VARCHAR(100)", log);
      await ensureColumn("nfts", "manufacture_date", "TIMESTAMPTZ", log);
      await ensureColumn("nfts", "expiry_date", "TIMESTAMPTZ", log);
      await ensureColumn("nfts", "description", "TEXT", log);
      await ensureColumn("nfts", "image_url", "TEXT", log);
      await ensureColumn("nfts", "certificate_url", "TEXT", log);
      await ensureColumn("nfts", "status", "VARCHAR(50) DEFAULT 'minted'", log);
      await ensureColumn("nfts", "ipfs_hash", "TEXT", log);
      await ensureColumn("nfts", "manufacturer_address", "VARCHAR(100)", log);
      await ensureColumn("nfts", "distributor_address", "VARCHAR(100)", log);
      await ensureColumn("nfts", "pharmacy_address", "VARCHAR(100)", log);
      await ensureColumn("nfts", "token_id", "VARCHAR(66)", log);
      await ensureColumn("nfts", "object_id", "VARCHAR(66)", log);
      await ensureColumn("nfts", "transaction_digest", "VARCHAR(100)", log);
      await ensureColumn("nfts", "quantity", "INTEGER DEFAULT 1", log);
      await ensureColumn("nfts", "last_dispensed_at", "TIMESTAMPTZ", log);
      await ensureColumn("nfts", "created_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      await ensureColumn("nfts", "updated_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_nfts_object_id ON nfts(object_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_nfts_token_id ON nfts(token_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_nfts_batch_number ON nfts(batch_number)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_nfts_manufacturer ON nfts(manufacturer_address)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_nfts_pharmacy ON nfts(pharmacy_address)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_nfts_status ON nfts(status)`);
      log("nfts table verified / patched");
    }

    // ─── 3. MILESTONES TABLE ──────────────────────────────────────────
    if (!(await tableExists("milestones"))) {
      await pool.query(`
        CREATE TABLE milestones (
          id SERIAL PRIMARY KEY,
          nft_id INTEGER,
          type VARCHAR(100),
          description TEXT,
          location TEXT,
          actor_address VARCHAR(100),
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_milestones_nft_id ON milestones(nft_id)`);
      log("Created milestones table");
    } else {
      await ensureColumn("milestones", "id", "SERIAL PRIMARY KEY", log);
      await ensureColumn("milestones", "nft_id", "INTEGER", log);
      await ensureColumn("milestones", "type", "VARCHAR(100)", log);
      await ensureColumn("milestones", "description", "TEXT", log);
      await ensureColumn("milestones", "location", "TEXT", log);
      await ensureColumn("milestones", "actor_address", "VARCHAR(100)", log);
      await ensureColumn("milestones", "timestamp", "TIMESTAMPTZ DEFAULT NOW()", log);
      await ensureColumn("milestones", "created_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_milestones_nft_id ON milestones(nft_id)`);
      log("milestones table verified / patched");
    }

    // ─── 4. TRANSFER_REQUESTS TABLE ───────────────────────────────────
    if (!(await tableExists("transfer_requests"))) {
      await pool.query(`
        CREATE TABLE transfer_requests (
          id SERIAL PRIMARY KEY,
          nft_id INTEGER,
          distributor_address VARCHAR(100),
          pharmacy_address VARCHAR(100),
          status VARCHAR(50) DEFAULT 'pending',
          object_id VARCHAR(66),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_transfer_requests_nft_id ON transfer_requests(nft_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_transfer_requests_status ON transfer_requests(status)`);
      log("Created transfer_requests table");
    } else {
      await ensureColumn("transfer_requests", "id", "SERIAL PRIMARY KEY", log);
      await ensureColumn("transfer_requests", "nft_id", "INTEGER", log);
      await ensureColumn("transfer_requests", "distributor_address", "VARCHAR(100)", log);
      await ensureColumn("transfer_requests", "pharmacy_address", "VARCHAR(100)", log);
      await ensureColumn("transfer_requests", "status", "VARCHAR(50) DEFAULT 'pending'", log);
      await ensureColumn("transfer_requests", "object_id", "VARCHAR(66)", log);
      await ensureColumn("transfer_requests", "created_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      await ensureColumn("transfer_requests", "updated_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_transfer_requests_nft_id ON transfer_requests(nft_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_transfer_requests_status ON transfer_requests(status)`);
      log("transfer_requests table verified / patched");
    }

    // ─── 5. NOTIFICATIONS TABLE ───────────────────────────────────────
    if (!(await tableExists("notifications"))) {
      await pool.query(`
        CREATE TABLE notifications (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255),
          type VARCHAR(50),
          title TEXT,
          message TEXT,
          read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
      log("Created notifications table");
    }else {
      await ensureColumn("notifications", "id", "SERIAL PRIMARY KEY", log);
      await ensureColumn("notifications", "user_id", "VARCHAR(255)", log);
      await ensureColumn("notifications", "type", "VARCHAR(50)", log);
      await ensureColumn("notifications", "title", "TEXT", log);
      await ensureColumn("notifications", "message", "TEXT", log);
      await ensureColumn("notifications", "read", "BOOLEAN DEFAULT FALSE", log);
      await ensureColumn("notifications", "created_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
      log("notifications table verified / patched");
    }

    // ─── 6. AGENT_AUDIT_LOGS TABLE ────────────────────────────────────
    if (!(await tableExists("agent_audit_logs"))) {
      await pool.query(`
        CREATE TABLE agent_audit_logs (
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
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_timestamp ON agent_audit_logs(timestamp)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_user_id ON agent_audit_logs(user_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_tool ON agent_audit_logs(tool)`);
      log("Created agent_audit_logs table");
    }else {
      await ensureColumn("agent_audit_logs", "id", "SERIAL PRIMARY KEY", log);
      await ensureColumn("agent_audit_logs", "user_id", "VARCHAR(255)", log);
      await ensureColumn("agent_audit_logs", "tool", "VARCHAR(100)", log);
      await ensureColumn("agent_audit_logs", "action", "TEXT", log);
      await ensureColumn("agent_audit_logs", "result", "VARCHAR(50)", log);
      await ensureColumn("agent_audit_logs", "error", "TEXT", log);
      await ensureColumn("agent_audit_logs", "metadata", "JSONB", log);
      await ensureColumn("agent_audit_logs", "timestamp", "TIMESTAMPTZ DEFAULT NOW()", log);
      await ensureColumn("agent_audit_logs", "updated_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_timestamp ON agent_audit_logs(timestamp)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_user_id ON agent_audit_logs(user_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_tool ON agent_audit_logs(tool)`);
      log("agent_audit_logs table verified / patched");
    }

    // ─── 7. TX_RECOVERY_LOG TABLE (TransactionManager idempotency) ────
    if (!(await tableExists("tx_recovery_log"))) {
      await pool.query(`
        CREATE TABLE tx_recovery_log (
          id SERIAL PRIMARY KEY,
          idempotency_key VARCHAR(500) UNIQUE NOT NULL,
          result JSONB,
          status VARCHAR(20) NOT NULL,
          error_message TEXT,
          error_stack TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_tx_recovery_idem ON tx_recovery_log(idempotency_key)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_tx_recovery_created ON tx_recovery_log(created_at)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_tx_recovery_status ON tx_recovery_log(status)`);
      log("Created tx_recovery_log table with indexes");
    } else {
      await ensureColumn("tx_recovery_log", "id", "SERIAL PRIMARY KEY", log);
      await ensureColumn("tx_recovery_log", "idempotency_key", "VARCHAR(500) UNIQUE NOT NULL", log);
      await ensureColumn("tx_recovery_log", "result", "JSONB", log);
      await ensureColumn("tx_recovery_log", "status", "VARCHAR(20)", log);
      await ensureColumn("tx_recovery_log", "error_message", "TEXT", log);
      await ensureColumn("tx_recovery_log", "error_stack", "TEXT", log);
      await ensureColumn("tx_recovery_log", "created_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      await ensureColumn("tx_recovery_log", "updated_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      log("tx_recovery_log table verified / patched");
    }

    // ─── 8. DISPENSING_RECORDS TABLE (dispense route) ─────────────────
    if (!(await tableExists("dispensing_records"))) {
      await pool.query(`
        CREATE TABLE dispensing_records (
          id VARCHAR(100) PRIMARY KEY,
          nft_id INTEGER,
          pharmacy_address VARCHAR(100),
          customer_id VARCHAR(255),
          quantity INTEGER DEFAULT 1,
          prescription_id VARCHAR(255),
          dispensed_at TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_dispensing_nft_id ON dispensing_records(nft_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_dispensing_pharmacy ON dispensing_records(pharmacy_address)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_dispensing_customer ON dispensing_records(customer_id)`);
      log("Created dispensing_records table with indexes");
    } else {
      await ensureColumn("dispensing_records", "id", "VARCHAR(100)", log);
      await ensureColumn("dispensing_records", "nft_id", "INTEGER", log);
      await ensureColumn("dispensing_records", "pharmacy_address", "VARCHAR(100)", log);
      await ensureColumn("dispensing_records", "customer_id", "VARCHAR(255)", log);
      await ensureColumn("dispensing_records", "quantity", "INTEGER DEFAULT 1", log);
      await ensureColumn("dispensing_records", "prescription_id", "VARCHAR(255)", log);
      await ensureColumn("dispensing_records", "dispensed_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      await ensureColumn("dispensing_records", "created_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      log("dispensing_records table verified / patched");
    }

    // ─── 9. WEBHOOKS TABLE (lib/ai-agent/webhooks.ts) ─────────────────
    if (!(await tableExists("webhooks"))) {
      await pool.query(`
        CREATE TABLE webhooks (
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
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(enabled)`);
      log("Created webhooks table with indexes");
    } else {
      await ensureColumn("webhooks", "id", "SERIAL PRIMARY KEY", log);
      await ensureColumn("webhooks", "name", "VARCHAR(255)", log);
      await ensureColumn("webhooks", "url", "TEXT", log);
      await ensureColumn("webhooks", "events", "JSONB", log);
      await ensureColumn("webhooks", "secret", "VARCHAR(255)", log);
      await ensureColumn("webhooks", "enabled", "BOOLEAN DEFAULT true", log);
      await ensureColumn("webhooks", "headers", "JSONB", log);
      await ensureColumn("webhooks", "retry_count", "INTEGER DEFAULT 0", log);
      await ensureColumn("webhooks", "success_count", "INTEGER DEFAULT 0", log);
      await ensureColumn("webhooks", "failure_count", "INTEGER DEFAULT 0", log);
      await ensureColumn("webhooks", "created_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      await ensureColumn("webhooks", "updated_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      log("webhooks table verified / patched");
    }

    // ─── 10. WEBHOOK_EVENTS TABLE (lib/ai-agent/webhooks.ts) ──────────
    if (!(await tableExists("webhook_events"))) {
      await pool.query(`
        CREATE TABLE webhook_events (
          id VARCHAR(100) PRIMARY KEY,
          webhook_id INTEGER REFERENCES webhooks(id) ON DELETE CASCADE,
          event VARCHAR(100) NOT NULL,
          payload JSONB NOT NULL,
          status VARCHAR(20) NOT NULL,
          attempts INTEGER DEFAULT 0,
          last_attempt TIMESTAMP,
          response JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook_id ON webhook_events(webhook_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON webhook_events(created_at)`);
      log("Created webhook_events table with indexes");
    } else {
      await ensureColumn("webhook_events", "id", "VARCHAR(100)", log);
      await ensureColumn("webhook_events", "webhook_id", "INTEGER", log);
      await ensureColumn("webhook_events", "event", "VARCHAR(100)", log);
      await ensureColumn("webhook_events", "payload", "JSONB", log);
      await ensureColumn("webhook_events", "status", "VARCHAR(20)", log);
      await ensureColumn("webhook_events", "attempts", "INTEGER DEFAULT 0", log);
      await ensureColumn("webhook_events", "last_attempt", "TIMESTAMP", log);
      await ensureColumn("webhook_events", "response", "JSONB", log);
      await ensureColumn("webhook_events", "created_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      log("webhook_events table verified / patched");
    }

    // ─── 11. ROLE_REGISTRATIONS TABLE ───────────────────────────────
    if (!(await tableExists("role_registrations"))) {
      await pool.query(`
        CREATE TABLE role_registrations (
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
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_role_registrations_status ON role_registrations(status)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_role_registrations_address ON role_registrations(wallet_address)`);
      log("Created role_registrations table with indexes");
    } else {
      await ensureColumn("role_registrations", "id", "SERIAL PRIMARY KEY", log);
      await ensureColumn("role_registrations", "wallet_address", "VARCHAR(100)", log);
      await ensureColumn("role_registrations", "requested_role", "VARCHAR(20)", log);
      await ensureColumn("role_registrations", "company_name", "TEXT", log);
      await ensureColumn("role_registrations", "license_number", "TEXT", log);
      await ensureColumn("role_registrations", "license_ipfs_hash", "TEXT", log);
      await ensureColumn("role_registrations", "tax_id", "TEXT", log);
      await ensureColumn("role_registrations", "distributor_name", "TEXT", log);
      await ensureColumn("role_registrations", "distributor_address", "TEXT", log);
      await ensureColumn("role_registrations", "pharmacy_name", "TEXT", log);
      await ensureColumn("role_registrations", "pharmacy_address", "TEXT", log);
      await ensureColumn("role_registrations", "contact_email", "TEXT", log);
      await ensureColumn("role_registrations", "contact_phone", "TEXT", log);
      await ensureColumn("role_registrations", "notes", "TEXT", log);
      await ensureColumn("role_registrations", "status", "VARCHAR(20) DEFAULT 'pending'", log);
      await ensureColumn("role_registrations", "reviewed_by", "VARCHAR(100)", log);
      await ensureColumn("role_registrations", "reviewed_at", "TIMESTAMPTZ", log);
      await ensureColumn("role_registrations", "rejection_reason", "TEXT", log);
      await ensureColumn("role_registrations", "blockchain_tx", "VARCHAR(255)", log);
      await ensureColumn("role_registrations", "created_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      await ensureColumn("role_registrations", "updated_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_role_registrations_status ON role_registrations(status)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_role_registrations_address ON role_registrations(wallet_address)`);
      log("role_registrations table verified / patched");
    }

    // ─── 12. ONCHAIN_PROPOSALS TABLE (lib/db/migrations.ts) ───────────
    if (!(await tableExists("onchain_proposals"))) {
      await pool.query(`
        CREATE TABLE onchain_proposals (
          id SERIAL PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          proposal_data JSONB NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          created_by VARCHAR(255),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          executed_at TIMESTAMPTZ,
          transaction_digest VARCHAR(255)
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_onchain_proposals_status ON onchain_proposals(status)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_onchain_proposals_created_by ON onchain_proposals(created_by)`);
      log("Created onchain_proposals table with indexes");
    } else {
      await ensureColumn("onchain_proposals", "id", "SERIAL PRIMARY KEY", log);
      await ensureColumn("onchain_proposals", "type", "VARCHAR(50)", log);
      await ensureColumn("onchain_proposals", "proposal_data", "JSONB", log);
      await ensureColumn("onchain_proposals", "status", "VARCHAR(20) DEFAULT 'pending'", log);
      await ensureColumn("onchain_proposals", "created_by", "VARCHAR(255)", log);
      await ensureColumn("onchain_proposals", "created_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      await ensureColumn("onchain_proposals", "executed_at", "TIMESTAMPTZ", log);
      await ensureColumn("onchain_proposals", "transaction_digest", "VARCHAR(255)", log);
      log("onchain_proposals table verified / patched");
    }

    // ─── 13. WORKFLOWS TABLE (lib/ai-agent/workflow.ts) ─────────────────
    if (!(await tableExists("workflows"))) {
      await pool.query(`
        CREATE TABLE workflows (
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
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_workflows_enabled ON workflows(enabled)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_workflows_schedule ON workflows(schedule)`);
      log("Created workflows table with indexes");
    } else {
      await ensureColumn("workflows", "id", "SERIAL PRIMARY KEY", log);
      await ensureColumn("workflows", "name", "VARCHAR(255)", log);
      await ensureColumn("workflows", "description", "TEXT", log);
      await ensureColumn("workflows", "task", "TEXT", log);
      await ensureColumn("workflows", "schedule", "VARCHAR(100)", log);
      await ensureColumn("workflows", "enabled", "BOOLEAN DEFAULT true", log);
      await ensureColumn("workflows", "last_run", "TIMESTAMP", log);
      await ensureColumn("workflows", "next_run", "TIMESTAMP", log);
      await ensureColumn("workflows", "run_count", "INTEGER DEFAULT 0", log);
      await ensureColumn("workflows", "success_count", "INTEGER DEFAULT 0", log);
      await ensureColumn("workflows", "failure_count", "INTEGER DEFAULT 0", log);
      await ensureColumn("workflows", "context", "JSONB", log);
      await ensureColumn("workflows", "created_by", "VARCHAR(100)", log);
      await ensureColumn("workflows", "created_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      await ensureColumn("workflows", "updated_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      log("workflows table verified / patched");
    }

    // ─── 14. WORKFLOW_EXECUTIONS TABLE (lib/ai-agent/workflow.ts) ──────
    if (!(await tableExists("workflow_executions"))) {
      await pool.query(`
        CREATE TABLE workflow_executions (
          id SERIAL PRIMARY KEY,
          workflow_id INTEGER,
          status VARCHAR(20) NOT NULL,
          started_at TIMESTAMP,
          completed_at TIMESTAMP,
          result JSONB,
          error TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status)`);
      log("Created workflow_executions table with indexes");
    } else {
      await ensureColumn("workflow_executions", "id", "SERIAL PRIMARY KEY", log);
      await ensureColumn("workflow_executions", "workflow_id", "INTEGER", log);
      await ensureColumn("workflow_executions", "status", "VARCHAR(20)", log);
      await ensureColumn("workflow_executions", "started_at", "TIMESTAMP", log);
      await ensureColumn("workflow_executions", "completed_at", "TIMESTAMP", log);
      await ensureColumn("workflow_executions", "result", "JSONB", log);
      await ensureColumn("workflow_executions", "error", "TEXT", log);
      await ensureColumn("workflow_executions", "created_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      log("workflow_executions table verified / patched");
    }

    // ─── 15. LEARNING_PATTERNS TABLE (lib/ai-agent/learning.ts) ────────
    if (!(await tableExists("learning_patterns"))) {
      await pool.query(`
        CREATE TABLE learning_patterns (
          id SERIAL PRIMARY KEY,
          pattern_type VARCHAR(20) NOT NULL,
          context JSONB,
          action TEXT NOT NULL,
          result JSONB,
          performance DECIMAL(3,2) DEFAULT 0,
          frequency INTEGER DEFAULT 1,
          last_seen TIMESTAMP,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_learning_patterns_type ON learning_patterns(pattern_type)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_learning_patterns_performance ON learning_patterns(performance)`);
      log("Created learning_patterns table with indexes");
    } else {
      await ensureColumn("learning_patterns", "id", "SERIAL PRIMARY KEY", log);
      await ensureColumn("learning_patterns", "pattern_type", "VARCHAR(20)", log);
      await ensureColumn("learning_patterns", "context", "JSONB", log);
      await ensureColumn("learning_patterns", "action", "TEXT", log);
      await ensureColumn("learning_patterns", "result", "JSONB", log);
      await ensureColumn("learning_patterns", "performance", "DECIMAL(3,2) DEFAULT 0", log);
      await ensureColumn("learning_patterns", "frequency", "INTEGER DEFAULT 1", log);
      await ensureColumn("learning_patterns", "last_seen", "TIMESTAMP", log);
      await ensureColumn("learning_patterns", "created_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      log("learning_patterns table verified / patched");
    }

    // ─── 16. ADAPTATION_RULES TABLE (lib/ai-agent/learning.ts) ──────────
    if (!(await tableExists("adaptation_rules"))) {
      await pool.query(`
        CREATE TABLE adaptation_rules (
          id SERIAL PRIMARY KEY,
          condition JSONB NOT NULL,
          action TEXT NOT NULL,
          priority INTEGER DEFAULT 1,
          enabled BOOLEAN DEFAULT true,
          success_rate DECIMAL(3,2) DEFAULT 0,
          usage_count INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_adaptation_rules_enabled ON adaptation_rules(enabled)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_adaptation_rules_priority ON adaptation_rules(priority)`);
      log("Created adaptation_rules table with indexes");
    } else {
      await ensureColumn("adaptation_rules", "id", "SERIAL PRIMARY KEY", log);
      await ensureColumn("adaptation_rules", "condition", "JSONB", log);
      await ensureColumn("adaptation_rules", "action", "TEXT", log);
      await ensureColumn("adaptation_rules", "priority", "INTEGER DEFAULT 1", log);
      await ensureColumn("adaptation_rules", "enabled", "BOOLEAN DEFAULT true", log);
      await ensureColumn("adaptation_rules", "success_rate", "DECIMAL(3,2) DEFAULT 0", log);
      await ensureColumn("adaptation_rules", "usage_count", "INTEGER DEFAULT 0", log);
      await ensureColumn("adaptation_rules", "created_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      log("adaptation_rules table verified / patched");
    }

    // ─── 17. AGENT_MEMORY TABLE (lib/ai-agent/memory.ts) ────────────────
    if (!(await tableExists("agent_memory"))) {
      await pool.query(`
        CREATE TABLE agent_memory (
          session_id VARCHAR(100) PRIMARY KEY,
          messages JSONB,
          context JSONB,
          created_at TIMESTAMP,
          updated_at TIMESTAMP
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_agent_memory_session ON agent_memory(session_id)`);
      log("Created agent_memory table with indexes");
    } else {
      await ensureColumn("agent_memory", "session_id", "VARCHAR(100)", log);
      await ensureColumn("agent_memory", "messages", "JSONB", log);
      await ensureColumn("agent_memory", "context", "JSONB", log);
      await ensureColumn("agent_memory", "created_at", "TIMESTAMP", log);
      await ensureColumn("agent_memory", "updated_at", "TIMESTAMP", log);
      log("agent_memory table verified / patched");
    }

    // ─── 18. TOKEN_USAGE TABLE (lib/ai-agent/cost-optimization.ts) ─────
    if (!(await tableExists("token_usage"))) {
      await pool.query(`
        CREATE TABLE token_usage (
          id SERIAL PRIMARY KEY,
          model VARCHAR(50) NOT NULL,
          prompt_tokens INTEGER NOT NULL,
          completion_tokens INTEGER NOT NULL,
          total_tokens INTEGER NOT NULL,
          cost DECIMAL(10,6) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage(model)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_token_usage_created ON token_usage(created_at)`);
      log("Created token_usage table with indexes");
    } else {
      await ensureColumn("token_usage", "id", "SERIAL PRIMARY KEY", log);
      await ensureColumn("token_usage", "model", "VARCHAR(50)", log);
      await ensureColumn("token_usage", "prompt_tokens", "INTEGER", log);
      await ensureColumn("token_usage", "completion_tokens", "INTEGER", log);
      await ensureColumn("token_usage", "total_tokens", "INTEGER", log);
      await ensureColumn("token_usage", "cost", "DECIMAL(10,6)", log);
      await ensureColumn("token_usage", "created_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      log("token_usage table verified / patched");
    }

    // ─── SUMMARY ──────────────────────────────────────────────────────
    // Verify all tables
    const tables = [
      "users", "nfts", "milestones", "transfer_requests",
      "notifications", "agent_audit_logs",
      "tx_recovery_log", "dispensing_records",
      "webhooks", "webhook_events",
      "role_registrations", "onchain_proposals",
      "workflows", "workflow_executions",
      "learning_patterns", "adaptation_rules",
      "agent_memory", "token_usage",
    ];
    const status: Record<string, boolean> = {};
    for (const t of tables) {
      status[t] = await tableExists(t);
    }

    log("Migration complete!");

    return NextResponse.json({
      success: true,
      message: "All migrations applied successfully",
      tables: status,
      logs,
    });
  } catch (error: any) {
    console.error("[MIGRATE] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        logs,
        detail: error.detail,
      },
      { status: 500 }
    );
  }
}

// ─── HELPERS ────────────────────────────────────────────────────────────

async function tableExists(tableName: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
    [tableName]
  );
  return result.rows[0].exists;
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT FROM information_schema.columns 
       WHERE table_name = $1 AND column_name = $2
     )`,
    [tableName, columnName]
  );
  return result.rows[0].exists;
}

/**
 * Ensure a column exists on a table. If missing, ALTER TABLE ADD COLUMN.
 * Skips "id" columns (cannot add SERIAL PK to existing table easily —
 * if the table exists without id, we recreate it).
 *
 * NOTE: ALTER TABLE ADD COLUMN does NOT accept DEFAULT inline in PostgreSQL.
 * The DEFAULT must be stripped from the definition and applied separately via
 * ALTER COLUMN ... SET DEFAULT after the column is added.
 */
async function ensureColumn(
  table: string,
  column: string,
  definition: string,
  log: (msg: string) => void
) {
  if (await columnExists(table, column)) return;

  // Special handling for "id SERIAL PRIMARY KEY" — need to add sequence
  if (column === "id" && definition.toUpperCase().includes("PRIMARY KEY")) {
    try {
      // Check if table has any primary key
      const pkCheck = await pool.query(
        `SELECT constraint_name FROM information_schema.table_constraints
         WHERE table_name = $1 AND constraint_type = 'PRIMARY KEY'`,
        [table]
      );

      if (pkCheck.rows.length === 0) {
        await pool.query(`ALTER TABLE ${table} ADD COLUMN id SERIAL PRIMARY KEY`);
        log(`Added id SERIAL PRIMARY KEY to ${table}`);
      } else {
        log(`${table} already has a primary key, skipping id column`);
      }
    } catch (e: any) {
      log(`Warning: Could not add id to ${table}: ${e.message}`);
    }
    return;
  }

  // ── Fix DEFAULT handling ────────────────────────────────────────────────
  // PostgreSQL ALTER TABLE ADD COLUMN does NOT accept DEFAULT inline (the only
  // exception is for columns with a literal default expression, but it's safer
  // to strip it and apply SET DEFAULT separately to avoid syntax errors, e.g.
  // from `VARCHAR(255) UNIQUE NOT NULL DEFAULT 'something'` or `BIGINT DEFAULT 0`.
  // ─────────────────────────────────────────────────────────────────────────
  const finalDef = definition
    .replace(/\s+DEFAULT\s+NOW\(\s*\)/gi, "")   // strip DEFAULT NOW()
    .replace(/\s+DEFAULT\s+'[^']*'/gi, "")       // strip DEFAULT 'literal'
    .replace(/\s+DEFAULT\s+\d+/gi, "")            // strip DEFAULT <number>
    .replace(/\s+UNIQUE\s+NOT\s+NULL/gi, " UNIQUE NOT NULL")
    .replace(/\s+NOT\s+NULL/gi, " NOT NULL")
    .trim();

  // Extract the DEFAULT value for separate application (if present in original)
  let defaultValue: string | null = null;
  const defaultMatch = definition.match(/DEFAULT\s+(.+?)(?=\s+(?:NOT\s+NULL|UNIQUE)|$)/i);
  if (defaultMatch) {
    const raw = defaultMatch[1].trim();
    // Normalise bare word / numeric defaults to a SQL expression for SET DEFAULT
    if (/^NOW\(\)$/i.test(raw)) {
      defaultValue = "NOW()";
    } else if (/^\d+$/.test(raw)) {
      defaultValue = raw;
    } else {
      // Leave as-is for SET DEFAULT (e.g. 'false', 'minted', etc.)
      defaultValue = raw;
    }
  }

  try {
    // Always use IF NOT EXISTS to be safe in concurrent environments
    await pool.query(
      `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${finalDef}`
    );
    log(`Added column ${column} to ${table}`);

    // Apply DEFAULT separately — only if we extracted a default value
    if (defaultValue !== null) {
      try {
        const safeCol = column.replace(/"/g, '""');
        if (/^NOW\(\)$/i.test(defaultValue)) {
          await pool.query(
            `ALTER TABLE ${table} ALTER COLUMN "${safeCol}" SET DEFAULT NOW()`
          );
        } else if (/^\d+$/.test(defaultValue)) {
          await pool.query(
            `ALTER TABLE ${table} ALTER COLUMN "${safeCol}" SET DEFAULT ${defaultValue}`
          );
        } else {
          await pool.query(
            `ALTER TABLE ${table} ALTER COLUMN "${safeCol}" SET DEFAULT '${defaultValue.replace(/'/g, "''")}'`
          );
        }
        log(`Set DEFAULT ${defaultValue} on column ${column} in ${table}`);
      } catch (defaultErr: any) {
        log(`Warning: Could not set DEFAULT on ${column} in ${table}: ${defaultErr.message}`);
      }
    }
  } catch (e: any) {
    log(`Warning: Could not add ${column} to ${table}: ${e.message}`);
  }
}
