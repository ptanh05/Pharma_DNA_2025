/**
 * Root Middleware — Protect /api/admin/* routes
 *
 * Uses jose (already installed) for JWT verification.
 * Reads access token from httpOnly cookie "admin_access_token".
 * Redirects API routes to 401 JSON on failure.
 */

import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";

const ADMIN_ACCESS_TOKEN_COOKIE = "admin_access_token";

/**
 * Get JWT secret as Uint8Array. Throws if not configured.
 */
function getJwtSecret(): Uint8Array {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error(
      "JWT_SECRET must be set and at least 32 characters long."
    );
  }
  return new TextEncoder().encode(JWT_SECRET);
}

/**
 * Routes that bypass admin auth entirely.
 */
const PUBLIC_ADMIN_ROUTES = ["/api/auth/admin/login", "/api/auth/admin/register", "/api/auth/admin/refresh"];

function isProtectedAdminRoute(pathname: string): boolean {
  return pathname.startsWith("/api/admin/") || pathname.startsWith("/api/auth/admin/");
}

function isPublicAdminRoute(pathname: string): boolean {
  return PUBLIC_ADMIN_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only intercept admin-related routes
  if (!isProtectedAdminRoute(pathname)) {
    return NextResponse.next();
  }

  // Allow public admin routes (login, register, refresh)
  if (isPublicAdminRoute(pathname)) {
    return NextResponse.next();
  }

  // Read access token from httpOnly cookie
  const accessToken = request.cookies.get(ADMIN_ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    return returnUnauthorized(request);
  }

  // Verify the JWT
  try {
    const secret = getJwtSecret();
    await jose.jwtVerify(accessToken, secret);

    // Token is valid — allow request through
    return NextResponse.next();
  } catch (error: any) {
    // jose throws on expired, malformed, or invalid signature
    const errorCode = error?.code ?? "";
    if (
      errorCode === "ERR_JWT_EXPIRED" ||
      errorCode === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" ||
      errorCode === "ERR_JWT_CLAIM_VALIDATION_FAILED"
    ) {
      return returnUnauthorized(request);
    }

    // Unknown error — treat as unauthorized
    console.error("[Admin Middleware] JWT verification error:", error);
    return returnUnauthorized(request);
  }
}

/**
 * Return 401 — JSON for API routes, redirect for page routes.
 */
function returnUnauthorized(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  // For page routes, redirect to login
  const loginUrl = new URL("/admin", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files
     */
    "/api/admin/:path*",
    "/api/auth/admin/:path*",
  ],
};
