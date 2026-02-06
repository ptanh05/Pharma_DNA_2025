/**
 * Admin Authentication Service
 * Handle admin login and session management
 */

import { pool } from "@/lib/db";
import { AppError, ErrorTypes } from "@/lib/utils/error-handler";
import { logger }from "@/lib/utils/logger";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
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
    if (password !== ADMIN_PASSWORD) {
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
    return "admin_" + Math.random().toString(36).substring(2, 15);
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

