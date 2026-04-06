/**
 * Admin Authentication Service
 * Cookie-based JWT session management — stateless (except rate-limiting &
 * invalidated-token sets which are in-memory, appropriate for serverless).
 *
 * All methods are async. Callers must await.
 */

import * as jose from "jose";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";
import { ensureTableExists } from "@/lib/db/table-init";
import { getLogger, logWarn, logInfo } from "@/lib/logger";
import { AppError, ErrorTypes } from "@/lib/utils/error-handler";
import { randomUUID } from "crypto";

// ─── Cookie constants ───────────────────────────────────────────────────────────
export const ACCESS_TOKEN_COOKIE = "admin_access_token";
export const REFRESH_TOKEN_COOKIE = "admin_refresh_token";

export const ACCESS_TOKEN_MAX_AGE = 15 * 60;   // 15 minutes in seconds
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  role: string;
  created_at: Date;
  last_login: Date | null;
}

export interface TokenPayload {
  sub: string;       // admin user id
  username: string;
  role: string;
  jti?: string;      // JWT ID — stored for token invalidation
}

export interface RateLimitInfo {
  count: number;
  resetTime: number; // Unix ms timestamp when window resets
}

// ─── In-memory state ──────────────────────────────────────────────────────────
// In a serverless environment these reset per cold-start — this is an acceptable
// trade-off for the security improvement. Use Redis for multi-instance production.
const invalidatedRefreshTokens = new Set<string>(); // jti -> Set

const rateLimitMap = new Map<string, RateLimitInfo>(); // IP -> {count, resetTime}

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 5;                     // max attempts per window

// ─── JWT helpers ──────────────────────────────────────────────────────────────

function getJwtSecret(): Uint8Array {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long.");
  }
  return new TextEncoder().encode(JWT_SECRET);
}

async function createAccessToken(user: AdminUser): Promise<{ token: string; expiresAt: number }> {
  const secret = getJwtSecret();
  const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_MAX_AGE;

  const token = await new jose.SignJWT({ username: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${ACCESS_TOKEN_MAX_AGE}s`)
    .setIssuedAt()
    .setSubject(user.id.toString())
    .setJti(randomUUID())
    .sign(secret);

  return { token, expiresAt };
}

async function createRefreshToken(userId: number): Promise<{ token: string; jti: string }> {
  const secret = getJwtSecret();
  const jti = randomUUID();

  await new jose.SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${REFRESH_TOKEN_MAX_AGE}s`)
    .setIssuedAt()
    .setSubject(userId.toString())
    .setJti(jti)
    .sign(secret);

  const payload = await new jose.SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${REFRESH_TOKEN_MAX_AGE}s`)
    .setIssuedAt()
    .setSubject(userId.toString())
    .setJti(jti)
    .sign(secret);

  return { token: payload, jti };
}

/**
 * Verify an access token. Returns payload or null if invalid/expired.
 */
async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const secret = getJwtSecret();
    const verified = await jose.jwtVerify(token, secret);
    const payload = verified.payload;
    return {
      sub: payload.sub as string,
      username: (payload as any).username as string,
      role: (payload as any).role as string,
      jti: payload.jti as string,
    };
  } catch (error: any) {
    if (
      error.code === "ERR_JWT_EXPIRED" ||
      error.code === "ERR_JWS_SIGNIFICATION_FAILED" ||
      error.code === "ERR_JWT_CLAIM_VALIDATION_FAILED"
    ) {
      return null;
    }
    logWarn("Access token verification error", { error: error.message });
    return null;
  }
}

/**
 * Verify a refresh token. Returns { userId, jti } or null.
 */
async function verifyRefreshToken(token: string): Promise<{ userId: number; jti: string } | null> {
  try {
    const secret = getJwtSecret();
    const verified = await jose.jwtVerify(token, secret);
    const payload = verified.payload;

    if (!payload.sub || !payload.jti) {
      return null;
    }

    if (isRefreshTokenInvalidated(payload.jti as string)) {
      return null;
    }

    return {
      userId: parseInt(payload.sub as string, 10),
      jti: payload.jti as string,
    };
  } catch (error: any) {
    if (
      error.code === "ERR_JWT_EXPIRED" ||
      error.code === "ERR_JWS_SIGNIFICATION_FAILED" ||
      error.code === "ERR_JWT_CLAIM_VALIDATION_FAILED"
    ) {
      return null;
    }
    logWarn("Refresh token verification error", { error: error.message });
    return null;
  }
}

// ─── Token invalidation ────────────────────────────────────────────────────────

function isRefreshTokenInvalidated(jti: string): boolean {
  return invalidatedRefreshTokens.has(jti);
}

function invalidateRefreshToken(jti: string): void {
  invalidatedRefreshTokens.add(jti);
}

// ─── Rate limiting ────────────────────────────────────────────────────────────

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const info = rateLimitMap.get(ip);

  if (!info || now > info.resetTime) {
    // Start new window
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }

  if (info.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetIn: info.resetTime - now };
  }

  info.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX - info.count, resetIn: info.resetTime - now };
}

// ─── Password hashing ─────────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Cookie helpers ──────────────────────────────────────────────────────────

/**
 * Build a Set-Cookie header string for the access token.
 */
export function buildAccessCookie(token: string, expiresAt: number): string {
  const maxAge = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
  return [
    `${ACCESS_TOKEN_COOKIE}=${token}`,
    `Path=/`,
    `HttpOnly`,
    `Secure`,
    `SameSite=Strict`,
    `Max-Age=${maxAge}`,
  ].join("; ");
}

/**
 * Build a Set-Cookie header string for the refresh token.
 */
export function buildRefreshCookie(token: string): string {
  return [
    `${REFRESH_TOKEN_COOKIE}=${token}`,
    `Path=/`,
    `HttpOnly`,
    `Secure`,
    `SameSite=Strict`,
    `Max-Age=${REFRESH_TOKEN_MAX_AGE}`,
  ].join("; ");
}

/**
 * Build a Set-Cookie header to clear a cookie.
 */
export function clearCookie(cookieName: string): string {
  return `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

// ─── Database helpers ─────────────────────────────────────────────────────────

async function ensureAdminTable(): Promise<void> {
  await ensureTableExists("admin_users", TABLE_DEFINITIONS.admin_users);
}

const TABLE_DEFINITIONS = {
  admin_users: `
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      role VARCHAR(50) DEFAULT 'admin',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      last_login TIMESTAMPTZ
    )
  `,
};

async function getAdminUserByUsername(username: string): Promise<AdminUser | null> {
  await ensureAdminTable();
  const { rows } = await pool.query<AdminUser>(
    "SELECT id, username, password_hash, email, role, created_at, last_login FROM admin_users WHERE username = $1",
    [username]
  );
  return rows[0] ?? null;
}

async function getAdminUserById(id: number): Promise<AdminUser | null> {
  await ensureAdminTable();
  const { rows } = await pool.query<AdminUser>(
    "SELECT id, username, email, role, created_at, last_login FROM admin_users WHERE id = $1",
    [id]
  );
  return rows[0] ?? null;
}

async function countAdminUsers(): Promise<number> {
  await ensureAdminTable();
  const { rows } = await pool.query<{ count: string }>("SELECT COUNT(*) as count FROM admin_users");
  return parseInt(rows[0]?.count ?? "0", 10);
}

async function createAdminUser(
  username: string,
  passwordHash: string,
  email?: string,
  role = "admin"
): Promise<AdminUser> {
  await ensureAdminTable();
  const { rows } = await pool.query<AdminUser>(
    `INSERT INTO admin_users (username, password_hash, email, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, email, role, created_at, last_login`,
    [username, passwordHash, email ?? null, role]
  );
  return rows[0];
}

async function updateLastLogin(id: number): Promise<void> {
  await pool.query(
    "UPDATE admin_users SET last_login = NOW() WHERE id = $1",
    [id]
  );
}

// ─── Public service methods ───────────────────────────────────────────────────

class AdminAuthService {
  /**
   * Register a new admin user.
   * - First admin: requires ADMIN_REGISTER_KEY env var.
   * - Subsequent admins: caller must provide a valid admin access token (verified by middleware).
   */
  async register(
    username: string,
    password: string,
    options?: { email?: string; role?: string; registerKey?: string }
  ): Promise<AdminUser> {
    if (!username || username.length < 3) {
      throw new AppError(
        "Username must be at least 3 characters.",
        ErrorTypes.VALIDATION_ERROR.code,
        ErrorTypes.VALIDATION_ERROR.statusCode
      );
    }

    if (!password || password.length < 8) {
      throw new AppError(
        "Password must be at least 8 characters.",
        ErrorTypes.VALIDATION_ERROR.code,
        ErrorTypes.VALIDATION_ERROR.statusCode
      );
    }

    const adminCount = await countAdminUsers();

    if (adminCount === 0) {
      // First admin — require registration key
      const ADMIN_REGISTER_KEY = process.env.ADMIN_REGISTER_KEY;
      if (!options?.registerKey || options.registerKey !== ADMIN_REGISTER_KEY) {
        if (!ADMIN_REGISTER_KEY) {
          throw new AppError(
            "ADMIN_REGISTER_KEY is not configured. Set it in your environment to create the first admin.",
            ErrorTypes.UNAUTHORIZED.code,
            ErrorTypes.UNAUTHORIZED.statusCode
          );
        }
        throw new AppError(
          "Invalid registration key.",
          ErrorTypes.UNAUTHORIZED.code,
          ErrorTypes.UNAUTHORIZED.statusCode
        );
      }
    }

    const existing = await getAdminUserByUsername(username);
    if (existing) {
      throw new AppError(
        "Username already exists.",
        ErrorTypes.CONFLICT.code,
        ErrorTypes.CONFLICT.statusCode
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await createAdminUser(username, passwordHash, options?.email, options?.role ?? "admin");

    logInfo(`Admin user registered: ${username}`);
    return user;
  }

  /**
   * Authenticate an admin by username + password.
   * Returns { accessToken, refreshToken } cookie strings and user info.
   */
  async login(
    username: string,
    password: string
  ): Promise<{
    accessCookie: string;
    refreshCookie: string;
    user: Omit<AdminUser, "password_hash">;
  }> {
    const user = await getAdminUserByUsername(username);

    if (!user) {
      throw new AppError(
        "Invalid username or password.",
        ErrorTypes.UNAUTHORIZED.code,
        ErrorTypes.UNAUTHORIZED.statusCode
      );
    }

    const valid = await verifyPassword(password, (user as any).password_hash ?? "");
    if (!valid) {
      logWarn(`Failed login attempt for user: ${username}`);
      throw new AppError(
        "Invalid username or password.",
        ErrorTypes.UNAUTHORIZED.code,
        ErrorTypes.UNAUTHORIZED.statusCode
      );
    }

    const { token: accessToken, expiresAt } = await createAccessToken(user);
    const { token: refreshToken } = await createRefreshToken(user.id);

    await updateLastLogin(user.id);

    logInfo(`Admin login: ${username}`);

    const { password_hash: _, ...safeUser } = user as any;

    return {
      accessCookie: buildAccessCookie(accessToken, expiresAt),
      refreshCookie: buildRefreshCookie(refreshToken),
      user: safeUser as Omit<AdminUser, "password_hash">,
    };
  }

  /**
   * Refresh tokens using a valid refresh token.
   * Implements token rotation — old refresh token is invalidated after use.
   * Returns new cookie strings.
   */
  async refresh(refreshToken: string): Promise<{
    accessCookie: string;
    refreshCookie: string;
  }> {
    const result = await verifyRefreshToken(refreshToken);

    if (!result) {
      throw new AppError(
        "Invalid or expired refresh token.",
        ErrorTypes.UNAUTHORIZED.code,
        ErrorTypes.UNAUTHORIZED.statusCode
      );
    }

    // Invalidate old refresh token (rotation)
    invalidateRefreshToken(result.jti);

    const user = await getAdminUserById(result.userId);
    if (!user) {
      throw new AppError(
        "Admin user not found.",
        ErrorTypes.NOT_FOUND.code,
        ErrorTypes.NOT_FOUND.statusCode
      );
    }

    const { token: accessToken, expiresAt } = await createAccessToken(user);
    const { token: newRefreshToken } = await createRefreshToken(user.id);

    logInfo(`Token refresh for user: ${user.username}`);

    return {
      accessCookie: buildAccessCookie(accessToken, expiresAt),
      refreshCookie: buildRefreshCookie(newRefreshToken),
    };
  }

  /**
   * Logout — invalidate the provided refresh token.
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      const secret = getJwtSecret();
      const verified = await jose.jwtVerify(refreshToken, secret);
      const jti = verified.payload.jti as string;
      if (jti) {
        invalidateRefreshToken(jti);
      }
    } catch {
      // Token may be invalid/expired — nothing to invalidate
    }
    logInfo("Admin logout recorded");
  }

  /**
   * Verify an access token string. Used by API routes that need to
   * extract the current user after the middleware has already allowed them through.
   */
  async verifyAccessToken(token: string): Promise<TokenPayload | null> {
    return verifyAccessToken(token);
  }

  /**
   * Get admin user from an access token.
   */
  async getUserFromToken(token: string): Promise<AdminUser | null> {
    const payload = await verifyAccessToken(token);
    if (!payload) return null;
    return getAdminUserById(parseInt(payload.sub, 10));
  }
}

export const adminAuthService = new AdminAuthService();
