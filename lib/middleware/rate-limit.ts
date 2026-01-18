/**
 * Rate Limiting Middleware
 * Simple in-memory rate limiter (for development)
 * For production, use Redis-based rate limiting
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string; // Error message
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
  message: "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
};

/**
 * Get client identifier (IP address or wallet address)
 */
function getClientId(req: Request): string {
  // Try to get wallet address from header
  const walletAddress = req.headers.get("x-wallet-address") || 
                       req.headers.get("x-distributor-address") ||
                       req.headers.get("x-pharmacy-address");
  
  if (walletAddress) {
    return walletAddress.toLowerCase();
  }

  // Fallback to IP address
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : 
             req.headers.get("x-real-ip") || 
             "unknown";
  
  return ip;
}

/**
 * Rate limit middleware
 */
export function rateLimit(
  config: Partial<RateLimitConfig> = {}
): (req: Request) => Promise<Response | null> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return async (req: Request): Promise<Response | null> => {
    const clientId = getClientId(req);
    const now = Date.now();
    const key = `${clientId}:${req.method}:${new URL(req.url).pathname}`;

    // Clean up expired entries
    if (store[key] && store[key].resetTime < now) {
      delete store[key];
    }

    // Check rate limit
    if (!store[key]) {
      store[key] = {
        count: 1,
        resetTime: now + finalConfig.windowMs,
      };
      return null; // No rate limit exceeded
    }

    if (store[key].count >= finalConfig.maxRequests) {
      const resetTime = new Date(store[key].resetTime).toISOString();
      return new Response(
        JSON.stringify({
          error: finalConfig.message || "Rate limit exceeded",
          retryAfter: Math.ceil((store[key].resetTime - now) / 1000), // seconds
          resetTime,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil((store[key].resetTime - now) / 1000)),
            "X-RateLimit-Limit": String(finalConfig.maxRequests),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(store[key].resetTime),
          },
        }
      );
    }

    // Increment counter
    store[key].count++;

    // Set rate limit headers
    return null; // No rate limit exceeded
  };
}

/**
 * Get rate limit info for a client
 */
export function getRateLimitInfo(req: Request): {
  limit: number;
  remaining: number;
  reset: number;
} {
  const clientId = getClientId(req);
  const key = `${clientId}:${req.method}:${new URL(req.url).pathname}`;
  const entry = store[key];

  if (!entry) {
    return {
      limit: DEFAULT_CONFIG.maxRequests,
      remaining: DEFAULT_CONFIG.maxRequests,
      reset: Date.now() + DEFAULT_CONFIG.windowMs,
    };
  }

  return {
    limit: DEFAULT_CONFIG.maxRequests,
    remaining: Math.max(0, DEFAULT_CONFIG.maxRequests - entry.count),
    reset: entry.resetTime,
  };
}

/**
 * Clear rate limit for a client (useful for testing)
 */
export function clearRateLimit(clientId: string): void {
  Object.keys(store).forEach((key) => {
    if (key.startsWith(clientId)) {
      delete store[key];
    }
  });
}

