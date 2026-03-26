/**
 * Request/Response Middleware
 * Add security headers and logging
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";

/**
 * Add security headers
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Strict-Transport-Security", "max-age=31536000");
  response.headers.set("Content-Security-Policy", "default-src 'self'");
  return response;
}

/**
 * Log request
 */
export function logRequest(req: NextRequest): void {
  const method = req.method;
  const url = req.url;
  const ip = req.headers.get("x-forwarded-for") || "unknown";

  logger.info("request", `${method} ${url}`, { ip });
}

/**
 * Log response
 */
export function logResponse(
  method: string,
  url: string,
  statusCode: number,
  duration: number
): void {
  logger.info("response", `${method} ${url}- ${statusCode}`, { duration });
}

/**
 * Get client IP
 */
export function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

