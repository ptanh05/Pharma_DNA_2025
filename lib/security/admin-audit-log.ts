/**
 * Admin Audit Log Service
 * Records all sensitive admin actions with full context for security and compliance.
 */

import { pool } from "@/lib/db";
import { logger } from "@/lib/utils/logger";

// ─── Table definition (idempotent) ──────────────────────────────────────────
const AUDIT_LOG_TABLE = `
  CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    admin_id        VARCHAR(100),
    admin_username  VARCHAR(100),
    action          VARCHAR(100) NOT NULL,
    target_address  VARCHAR(255),
    target_role     VARCHAR(50),
    ip_address      VARCHAR(50),
    user_agent      TEXT,
    request_body    JSONB,
    response_status SMALLINT,
    result_message  TEXT,
    blockchain_tx   VARCHAR(255),
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )
`;

const AUDIT_LOG_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_id
  ON admin_audit_logs(admin_id)
`;

const AUDIT_LOG_INDEX_TARGET = `
  CREATE INDEX IF NOT EXISTS idx_admin_audit_target_address
  ON admin_audit_logs(target_address)
`;

const AUDIT_LOG_INDEX_ACTION = `
  CREATE INDEX IF NOT EXISTS idx_admin_audit_action
  ON admin_audit_logs(action)
`;

const AUDIT_LOG_INDEX_CREATED = `
  CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at
  ON admin_audit_logs(created_at DESC)
`;

let auditTableInitialized = false;

async function ensureAuditTable(): Promise<void> {
  if (auditTableInitialized) return;
  try {
    await pool.query(AUDIT_LOG_TABLE);
    await pool.query(AUDIT_LOG_INDEX);
    await pool.query(AUDIT_LOG_INDEX_TARGET);
    await pool.query(AUDIT_LOG_INDEX_ACTION);
    await pool.query(AUDIT_LOG_INDEX_CREATED);
    auditTableInitialized = true;
  } catch (e) {
    logger.error("audit-log", "Failed to create audit log table", e);
    auditTableInitialized = true; // Don't retry
  }
}

// ─── Action types ─────────────────────────────────────────────────────────────
export const AUDIT_ACTIONS = {
  ASSIGN_ROLE:     "ADMIN_ASSIGN_ROLE",
  UPDATE_ROLE:     "ADMIN_UPDATE_ROLE",
  REMOVE_ROLE:     "ADMIN_REMOVE_ROLE",
  UPDATE_USER_INFO: "ADMIN_UPDATE_USER_INFO",
  BACKUP_DATA:     "ADMIN_BACKUP_DATA",
  RESTORE_DATA:    "ADMIN_RESTORE_DATA",
  EXPORT_DATA:     "ADMIN_EXPORT_DATA",
  REVIEW_APPROVE:  "ADMIN_REVIEW_APPROVE",
  REVIEW_REJECT:   "ADMIN_REVIEW_REJECT",
  LOGIN:           "ADMIN_LOGIN",
  LOGOUT:          "ADMIN_LOGOUT",
  SETUP_ADMIN:     "ADMIN_SETUP",
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

// ─── Interface ─────────────────────────────────────────────────────────────────
export interface AuditLogEntry {
  adminId: string;
  adminUsername: string;
  action: AuditAction;
  targetAddress?: string;
  targetRole?: string;
  ipAddress?: string;
  userAgent?: string;
  requestBody?: Record<string, unknown>;
  responseStatus?: number;
  resultMessage?: string;
  blockchainTx?: string | null;
  metadata?: Record<string, unknown>;
}

// ─── Service ──────────────────────────────────────────────────────────────────
class AdminAuditLogService {
  constructor() {
    // Initialize table on first use
    ensureAuditTable().catch(() => {});
  }

  /**
   * Log a sensitive admin action asynchronously (non-blocking).
   * Failures are logged but never throw — audit logging must not break the action.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await ensureAuditTable();

      // Sanitize: never log passwords or sensitive fields
      const sanitizedBody = entry.requestBody
        ? sanitizeAuditBody(entry.requestBody)
        : null;

      await pool.query(
        `INSERT INTO admin_audit_logs
           (admin_id, admin_username, action, target_address, target_role,
            ip_address, user_agent, request_body, response_status,
            result_message, blockchain_tx, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          entry.adminId,
          entry.adminUsername,
          entry.action,
          entry.targetAddress ?? null,
          entry.targetRole ?? null,
          entry.ipAddress ?? null,
          entry.userAgent ?? null,
          sanitizedBody ?? null,
          entry.responseStatus ?? null,
          entry.resultMessage ?? null,
          entry.blockchainTx ?? null,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
        ]
      );
    } catch (e) {
      // Never throw — audit logging is a best-effort operation
      logger.error("audit-log", "Failed to write audit log", {
        action: entry.action,
        adminId: entry.adminId,
        targetAddress: entry.targetAddress,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /**
   * Get audit logs for a specific admin.
   */
  async getByAdmin(adminId: string, limit = 100) {
    const result = await pool.query(
      `SELECT * FROM admin_audit_logs
       WHERE admin_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [adminId, limit]
    );
    return result.rows;
  }

  /**
   * Get audit logs for a specific target address.
   */
  async getByTargetAddress(targetAddress: string, limit = 50) {
    const result = await pool.query(
      `SELECT * FROM admin_audit_logs
       WHERE target_address = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [targetAddress.toLowerCase(), limit]
    );
    return result.rows;
  }

  /**
   * Get recent audit logs (all actions).
   */
  async getRecent(limit = 100) {
    const result = await pool.query(
      `SELECT * FROM admin_audit_logs
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  /**
   * Get audit logs by action type.
   */
  async getByAction(action: AuditAction, limit = 100) {
    const result = await pool.query(
      `SELECT * FROM admin_audit_logs
       WHERE action = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [action, limit]
    );
    return result.rows;
  }

  /**
   * Get audit statistics for dashboard.
   */
  async getStats(sinceHours = 24) {
    const result = await pool.query(
      `SELECT action, COUNT(*) as count
       FROM admin_audit_logs
       WHERE created_at >= NOW() - INTERVAL '${sinceHours} hours'
       GROUP BY action
       ORDER BY count DESC`
    );
    return result.rows;
  }
}

/**
 * Remove sensitive fields from audit log body.
 */
function sanitizeAuditBody(body: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = [
    "password",
    "password_hash",
    "oldPassword",
    "newPassword",
    "currentPassword",
    "token",
    "refreshToken",
    "secret",
    "apiKey",
    "privateKey",
  ];

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (sensitiveFields.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeAuditBody(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export const adminAuditLog = new AdminAuditLogService();
