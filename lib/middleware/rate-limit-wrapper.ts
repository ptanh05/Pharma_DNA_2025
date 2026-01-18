/**
 * Rate Limit Wrapper for Next.js API Routes
 * Helper to apply rate limiting to API route handlers
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RateLimitConfig } from "./rate-limit";

/**
 * Wrap API route handler with rate limiting
 */
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config?: Partial<RateLimitConfig>
) {
  const rateLimiter = rateLimit(config);

  return async (req: NextRequest): Promise<NextResponse> => {
    // Check rate limit
    const rateLimitResponse = await rateLimiter(req);
    if (rateLimitResponse) {
      return NextResponse.json(
        await rateLimitResponse.json(),
        {
          status: rateLimitResponse.status,
          headers: Object.fromEntries(rateLimitResponse.headers.entries()),
        }
      );
    }

    // Call original handler
    return handler(req);
  };
}

/**
 * Rate limit configurations for different endpoints
 */
export const rateLimitConfigs = {
  // Strict rate limiting for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 requests per 15 minutes
    message: "Quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau 15 phút.",
  },
  
  // Moderate rate limiting for write operations
  write: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 30, // 30 requests per 15 minutes
    message: "Quá nhiều yêu cầu ghi dữ liệu. Vui lòng thử lại sau.",
  },
  
  // Lenient rate limiting for read operations
  read: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // 100 requests per 15 minutes
    message: "Quá nhiều yêu cầu đọc dữ liệu. Vui lòng thử lại sau.",
  },
  
  // Very strict for blockchain transactions
  blockchain: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
    message: "Quá nhiều yêu cầu blockchain. Vui lòng thử lại sau 1 phút.",
  },
};

