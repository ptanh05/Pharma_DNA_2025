/**
 * CORS Middleware
 * Cross-Origin Resource Sharing configuration
 */

import { NextRequest, NextResponse }from 'next/server';

/**
 * CORS configuration
 */
export const CORS_CONFIG = {
  // Allowed origins
  allowedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL || '',
    'https://pharma-dna.com',
    'https://*.pharma-dna.com',
  ].filter(Boolean),

  // Allowed methods
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],

  // Allowed headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-API-Key',
    'Accept',
    'Accept-Language',
  ],

  // Exposed headers
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Request-ID',
    'Retry-After',
  ],

  // Credentials
  credentials: true,

  // Max age (1 day)
  maxAge: 86400,

  // Preflight cache time
  preflightContinue: false,
};

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  // Check exact matches
  if (CORS_CONFIG.allowedOrigins.includes(origin)) {
    return true;
  }

  // Check wildcard patterns
  for (const allowedOrigin of CORS_CONFIG.allowedOrigins) {
    if (allowedOrigin.includes('*')) {
      const pattern = allowedOrigin
        .replace(/\*/g, '.*')
        .replace(/\./g, '\\.');
      if (new RegExp(`^${pattern}$`).test(origin)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * CORS middleware
 */
export function withCORS(handler: Function) {
  return async (req: NextRequest, ...args: any[]) => {
    const origin = req.headers.get('origin');

    // Check if origin is allowed
    const isAllowed = isOriginAllowed(origin);

    // Handle preflight request
    if (req.method === 'OPTIONS') {
      if (!isAllowed) {
        return new NextResponse(null, { status: 403 });
      }

      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': origin || '*',
          'Access-Control-Allow-Methods': CORS_CONFIG.allowedMethods.join(', '),
          'Access-Control-Allow-Headers': CORS_CONFIG.allowedHeaders.join(', '),
          'Access-Control-Expose-Headers': CORS_CONFIG.exposedHeaders.join(', '),
          'Access-Control-Allow-Credentials': String(CORS_CONFIG.credentials),
          'Access-Control-Max-Age': String(CORS_CONFIG.maxAge),
        },
      });
    }

    // Call handler
    const response = await handler(req, ...args);

    // Add CORS headers to response
    if (isAllowed && response instanceof NextResponse) {
      response.headers.set(
        'Access-Control-Allow-Origin',
        origin || '*'
      );
      response.headers.set(
        'Access-Control-Allow-Methods',
        CORS_CONFIG.allowedMethods.join(', ')
      );
      response.headers.set(
        'Access-Control-Allow-Headers',
        CORS_CONFIG.allowedHeaders.join(', ')
      );
      response.headers.set(
        'Access-Control-Expose-Headers',
        CORS_CONFIG.exposedHeaders.join(', ')
      );
      response.headers.set(
        'Access-Control-Allow-Credentials',
        String(CORS_CONFIG.credentials)
      );
    }

    return response;
  };
}

/**
 * Security headers middleware
 */
export function withSecurityHeaders(handler: Function) {
  return async (req: NextRequest, ...args: any[]) => {
    const response = await handler(req, ...args);

    if (response instanceof NextResponse) {
      // Prevent clickjacking
      response.headers.set('X-Frame-Options', 'DENY');

      // Prevent MIME sniffing
      response.headers.set('X-Content-Type-Options', 'nosniff');

      // Enable XSS protection
      response.headers.set('X-XSS-Protection', '1; mode=block');

      // Strict Transport Security (HSTS)
      response.headers.set(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );

      // Content Security Policy
      response.headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
      );

      // Referrer Policy
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

      // Permissions Policy
      response.headers.set(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=()'
      );
    }

    return response;
  };
}
