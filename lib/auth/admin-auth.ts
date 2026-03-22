/**
 * Admin Authentication Service
 * Handle admin login and session management
 */

import { pool } from "@/lib/db";
import { randomUUID } from 'crypto';
import { AppError, ErrorTypes } from "@/lib/utils/error-handler";
import { logger }from "@/lib/utils/logger";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
// Warn if using hardcoded fallback password
if (!ADMIN_PASSWORD) {
  console.warn('[AdminAuth] WARNING: ADMIN_PASSWORD not set. Using hardcoded default "admin" — INSECURE for production!');
}
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface AdminSession {
  token: string;
  createdAt: number;
  expiresAt: number;
}

class AdminAuthService {
  private sessions = new Map<string, AdminSession>();

  /**
   * Login admin
   */
  login(password: string): string {
    const validPassword = ADMIN_PASSWORD || "admin";
    if (password !== validPassword) {
      logger.warn("admin-auth", "Invalid admin password attempt");
      throw new AppError(
        "Invalid password",
        ErrorTypes.UNAUTHORIZED.code,
        ErrorTypes.UNAUTHORIZED.statusCode
      );
    }

    const token = this.generateToken();
    const now = Date.now();

    this.sessions.set(token, {
      token,
      createdAt: now,
      expiresAt: now + SESSION_DURATION,
    });

    logger.info("admin-auth", "Admin login successful");
    return token;
  }

  /**
   * Verify token
   */
  verifyToken(token: string): boolean {
    const session = this.sessions.get(token);

    if (!session) {
      return false;
    }

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return false;
    }

    return true;
  }

  /**
   * Logout
   */
  logout(token: string): void {
    this.sessions.delete(token);
    logger.info("admin-auth", "Admin logout successful");
  }

  /**
   * Generate token
   */
  private generateToken(): string {
    // Use cryptographically secure random UUID
    return "admin_" + randomUUID().replace(/-/g, '');
  }

  /**
   * Clear expired sessions
   */
  clearExpiredSessions(): void {
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(token);
      }
    }
  }
}

export const adminAuthService = new AdminAuthService();

