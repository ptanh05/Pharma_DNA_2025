/**
 * Security Utilities for AI Agent
 * Audit logs, permission checks, etc.
 */

import { pool } from "@/lib/db";
import { logger } from "@/lib/utils/logger";

export interface AuditLog {
  sessionId: string;
  userId?: string;
  action: string;
  tool: string;
  params: any;
  result: "success" | "failure";
  error?: string;
  timestamp: Date;
  ipAddress?: string;
}

/**
 * Log action to audit trail
 */
export async function logAction(auditLog: AuditLog): Promise<void> {
  try {
    // Create table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_audit_logs (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(100),
        user_id VARCHAR(100),
        action VARCHAR(100),
        tool VARCHAR(100),
        params JSONB,
        result VARCHAR(20),
        error TEXT,
        timestamp TIMESTAMP DEFAULT NOW(),
        ip_address VARCHAR(50)
      )
    `);

    await pool.query(
      `INSERT INTO agent_audit_logs 
       (session_id, user_id, action, tool, params, result, error, timestamp, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        auditLog.sessionId,
        auditLog.userId || null,
        auditLog.action,
        auditLog.tool,
        JSON.stringify(auditLog.params),
        auditLog.result,
        auditLog.error || null,
        auditLog.timestamp,
        auditLog.ipAddress || null,
      ]
    );
  } catch (error) {
    logger.error("AI_SECURITY", "Error logging action", error as Error);
    // Don't throw, audit logging is non-critical
  }
}

/**
 * Check if user has permission for action
 */
export async function checkPermission(
  userId: string,
  action: string,
  resource?: string
): Promise<boolean> {
  try {
    // Get user role from database
    const result = await pool.query(
      "SELECT role FROM users WHERE address = $1",
      [userId.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const role = result.rows[0].role;

    // Permission matrix
    const permissions: Record<string, string[]> = {
      mint_nft: ["MANUFACTURER", "ADMIN"],
      transfer_nft: ["MANUFACTURER", "DISTRIBUTOR", "PHARMACY", "ADMIN"],
      create_milestone: ["DISTRIBUTOR", "PHARMACY", "ADMIN"],
      auto_approve_transfer_requests: ["PHARMACY", "ADMIN"],
      generate_report: ["ADMIN"],
      check_system_health: ["ADMIN"],
    };

    const allowedRoles = permissions[action] || [];
    return allowedRoles.includes(role) || role === "ADMIN";
  } catch (error) {
    logger.error("AI_SECURITY", "Error checking permission", error as Error);
    return false;
  }
}

/**
 * Sanitize input to prevent injection
 */
export function sanitizeInput(input: string): string {
  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim();
}

/**
 * Validate and sanitize task input
 */
export function validateAndSanitizeTask(task: string): { valid: boolean; sanitized?: string; error?: string } {
  if (!task || task.trim().length === 0) {
    return { valid: false, error: "Task cannot be empty" };
  }

  if (task.length > 5000) {
    return { valid: false, error: "Task too long" };
  }

  const sanitized = sanitizeInput(task);
  
  // Check for SQL injection patterns
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /('|(\\')|(;)|(\\;)|(--)|(\\--)|(\/\*)|(\\\/\*)|(\*\/)|(\\\*\/))/i,
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(task)) {
      return { valid: false, error: "Task contains potentially dangerous patterns" };
    }
  }

  return { valid: true, sanitized };
}

