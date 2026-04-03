/**
 * Admin Authentication Service
 * JWT-based session management — stateless, works across serverless instances.
 *
 * All methods are async. Callers must await.
 */

import * as jose from 'jose';
import { AppError, ErrorTypes } from "@/lib/utils/error-handler";
import { logger } from "@/lib/utils/logger";

function getJwtSecret(): Uint8Array {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error(
      'JWT_SECRET must be set and at least 32 characters long. '
      + 'Set it in your .env file before starting the server.'
    );
  }
  return new TextEncoder().encode(JWT_SECRET);
}

class AdminAuthService {
  /**
   * Login admin.
   * Returns a signed JWT with 24h expiry.
   */
  async login(password: string): Promise<string> {
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    if (!ADMIN_PASSWORD) {
      throw new AppError(
        'ADMIN_PASSWORD environment variable is not set. '
        + 'Cannot authenticate admin. Set ADMIN_PASSWORD in your environment.',
        ErrorTypes.INTERNAL_ERROR.code,
        ErrorTypes.INTERNAL_ERROR.statusCode
      );
    }

    if (password !== ADMIN_PASSWORD) {
      logger.warn("admin-auth", "Invalid admin password attempt");
      throw new AppError(
        "Invalid password",
        ErrorTypes.UNAUTHORIZED.code,
        ErrorTypes.UNAUTHORIZED.statusCode
      );
    }

    const secret = getJwtSecret();
    const token = await new jose.SignJWT({ sub: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .setIssuedAt()
      .sign(secret);

    logger.info("admin-auth", "Admin login successful");
    return token;
  }

  /**
   * Verify a JWT token.
   * Returns true if valid, false if missing/invalid/expired.
   */
  async verifyToken(token: string): Promise<boolean> {
    if (!token) {
      return false;
    }

    try {
      const secret = getJwtSecret();
      await jose.jwtVerify(token, secret);
      return true;
    } catch (error: any) {
      // jose throws on expired or malformed tokens — treat both as invalid
      if (
        error.code === 'ERR_JWT_EXPIRED' ||
        error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' ||
        error.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED'
      ) {
        return false;
      }
      logger.warn("admin-auth", "Token verification error", error);
      return false;
    }
  }

  /**
   * Logout is a no-op for JWT-based sessions.
   * The client simply discards the token. No server-side state to invalidate.
   * This method is kept for interface compatibility with existing callers.
   */
  logout(_token: string): void {
    // Stateless — nothing to delete on the server.
    logger.info("admin-auth", "Admin logout recorded (JWT discarded client-side)");
  }
}

export const adminAuthService = new AdminAuthService();
