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
      await ensureColumn("nfts", "created_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      await ensureColumn("nfts", "updated_at", "TIMESTAMPTZ DEFAULT NOW()", log);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_nfts_object_id ON nfts(object_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_nfts_token_id ON nfts(token_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_nfts_batch_number ON nfts(batch_number)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_nfts_manufacturer ON nfts(manufacturer_address)`);
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

    // ─── SUMMARY ──────────────────────────────────────────────────────
    // Verify all tables
    const tables = ["users", "nfts", "milestones", "transfer_requests", "notifications", "agent_audit_logs"];
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

  // Strip DEFAULT for ALTER TABLE ADD COLUMN (simpler)
  // Keep just the type part for ADD COLUMN
  const cleanDef = definition.replace(/\s+UNIQUE\s+NOT\s+NULL/i, "").trim();

  try {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${cleanDef}`);
    log(`Added column ${column}to ${table}`);
  } catch (e: any) {
    log(`Warning: Could not add ${column} to ${table}: ${e.message}`);
  }
}
