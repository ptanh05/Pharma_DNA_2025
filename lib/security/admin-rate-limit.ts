/**
 * Admin Sensitive Action Rate Limiter
 * Rate limiting specific to sensitive admin operations.
 *
 * Separate from the general rate limiter — targets dangerous actions like
 * assign-role, remove-role, update-user-info, etc.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
  windowMs: number;
}

interface RateLimitConfig {
  windowMs: number;  // Time window in ms
  maxRequests: number; // Max requests per window
}

/** Default configs per action type */
const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Critical: assign/remove role — most restricted
  "assign-role":   { windowMs: 60 * 1000,      maxRequests: 5  },  // 5/min
  "remove-role":   { windowMs: 60 * 1000,      maxRequests: 5  },  // 5/min
  "update-user":   { windowMs: 60 * 1000,      maxRequests: 10 },  // 10/min
  "backup":        { windowMs: 5 * 60 * 1000,   maxRequests: 3  },  // 3/5min
  "restore":       { windowMs: 10 * 60 * 1000,  maxRequests: 2  },  // 2/10min
  "export":        { windowMs: 2 * 60 * 1000,   maxRequests: 5  },  // 5/2min
  // Review registration is slightly less restricted
  "review-reg":    { windowMs: 60 * 1000,      maxRequests: 20 },  // 20/min
};

const DEFAULT_CONFIG: RateLimitConfig = { windowMs: 60 * 1000, maxRequests: 10 };

// In-memory store: `${adminId}:${action}` -> entry
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries periodically (runs every 5 minutes)
 */
function cleanupExpired() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpired, 5 * 60 * 1000);

/**
 * Get client IP from request headers.
 */
function getClientIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIP = req.headers.get("x-real-ip");
  if (realIP) return realIP.trim();
  return "unknown";
}

/**
 * Check rate limit for a sensitive admin action.
 * Returns null if allowed, or a Response with 429 if exceeded.
 */
export function checkSensitiveActionRateLimit(
  adminId: string,
  action: string
): Response | null {
  const config = RATE_LIMIT_CONFIGS[action] ?? DEFAULT_CONFIG;
  const key = `${adminId}:${action}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    // Start new window
    entry = {
      count: 1,
      resetTime: now + config.windowMs,
      windowMs: config.windowMs,
    };
    rateLimitStore.set(key, entry);
    return null;
  }

  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: `Thao tác bị giới hạn. Vui lòng đợi ${retryAfter} giây.`,
          retryAfter,
        },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(config.maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(entry.resetTime / 1000)),
          "X-RateLimit-Window": String(Math.ceil(config.windowMs / 1000)),
        },
      }
    );
  }

  entry.count++;
  rateLimitStore.set(key, entry);
  return null;
}

/**
 * Get rate limit info for display (e.g., in response headers).
 */
export function getSensitiveActionRateLimitInfo(
  adminId: string,
  action: string
): { limit: number; remaining: number; resetIn: number } {
  const config = RATE_LIMIT_CONFIGS[action] ?? DEFAULT_CONFIG;
  const key = `${adminId}:${action}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    return { limit: config.maxRequests, remaining: config.maxRequests, resetIn: 0 };
  }

  return {
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetIn: Math.max(0, Math.ceil((entry.resetTime - now) / 1000)),
  };
}

/**
 * Action identifiers for rate limiting.
 * Use these constants when calling checkSensitiveActionRateLimit.
 */
export const SENSITIVE_ACTIONS = {
  ASSIGN_ROLE:    "assign-role",
  REMOVE_ROLE:    "remove-role",
  UPDATE_USER:    "update-user",
  BACKUP:        "backup",
  RESTORE:       "restore",
  EXPORT:        "export",
  REVIEW_REG:     "review-reg",
} as const;
