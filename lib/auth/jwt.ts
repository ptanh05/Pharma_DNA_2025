/**
 * JWT Authentication Utilities
 * Hỗ trợ tạo, xác minh và refresh JWT tokens
 */

import * as jose from 'jose';

/**
 * Get JWT secret - validates only at runtime when called
 * This function throws an error ONLY when actually trying to use JWT functionality,
 * not at module import time during build.
 */
function getJwtSecret(): Uint8Array {
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
  }

  return new TextEncoder().encode(JWT_SECRET);
}

export interface UserPayload {
  userId: string;
  address: string;
  role: 'MANUFACTURER' | 'DISTRIBUTOR' | 'PHARMACY' | 'ADMIN' | 'CONSUMER';
  email?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Seconds
}

/**
 * Tạo JWT token cho user
 */
export async function createAccessToken(user: UserPayload): Promise<string> {
  try {
    const secret = getJwtSecret();
    const token = await new jose.SignJWT(user)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .setIssuedAt()
      .setSubject(user.userId)
      .sign(secret);

    return token;
  } catch (error) {
    console.error('[JWT] Error creating access token:', error);
    throw new Error('Failed to create access token');
  }
}

/**
 * Tạo refresh token (có hạn 7 ngày)
 */
export async function createRefreshToken(userId: string): Promise<string> {
  try {
    const secret = getJwtSecret();
    const token = await new jose.SignJWT({ userId })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .setIssuedAt()
      .setSubject(userId)
      .sign(secret);

    return token;
  }catch (error) {
    console.error('[JWT] Error creating refresh token:', error);
    throw new Error('Failed to create refresh token');
  }
}

/**
 * Tạo cặp tokens (access + refresh)
 */
export async function createTokenPair(user: UserPayload): Promise<TokenPair> {
  try {
    const accessToken = await createAccessToken(user);
    const refreshToken = await createRefreshToken(user.userId);

    return {
      accessToken,
      refreshToken,
      expiresIn: 24 * 60 * 60, // 24 hours in seconds
    };
  }catch (error) {
    console.error('[JWT] Error creating token pair:', error);
    throw error;
  }
}

/**
 * Xác minh JWT token
 */
export async function verifyToken(token: string): Promise<UserPayload> {
  try {
    const secret = getJwtSecret();
    const verified = await jose.jwtVerify(token, secret);
    return verified.payload as unknown as UserPayload;
  }catch (error: any) {
    if (error.code === 'ERR_JWT_EXPIRED') {
      throw new Error('Token has expired');
    }
    if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
      throw new Error('Invalid token signature');
    }
    console.error('[JWT] Error verifying token:', error);
    throw new Error('Invalid token');
  }
}

/**
 * Xác minh refresh token
 */
export async function verifyRefreshToken(token: string): Promise<{ userId: string }> {
  try {
    const secret = getJwtSecret();
    const verified = await jose.jwtVerify(token, secret);
    return { userId: verified.payload.sub as string };
  }catch (error) {
    console.error('[JWT] Error verifying refresh token:', error);
    throw new Error('Invalid refresh token');
  }
}

/**
 * Trích xuất token từ Authorization header
 * Format: "Bearer <token>"
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }

  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.substring(7);
}

/**
 * Kiểm tra xem token còn hạn bao lâu
 */
export async function getTokenTimeRemaining(token: string): Promise<number> {
  try {
    const decoded = jose.decodeJwt(token);
    if (!decoded.exp) {
      return 0;
    }

    const expiresAt = decoded.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const remaining = expiresAt - now;

    return Math.max(0, remaining);
  }catch (error) {
    console.error('[JWT] Error getting token time remaining:', error);
    return 0;
  }
}

/**
 * Decode JWT token (không verify)
 * Chỉ dùng để inspect token, không verify signature
 */
export function decodeToken(token: string): Partial<UserPayload> | null {
  try {
    const decoded = jose.decodeJwt(token);
    return decoded as unknown as Partial<UserPayload>;
  }catch (error) {
    console.error('[JWT] Error decoding token:', error);
    return null;
  }
}
