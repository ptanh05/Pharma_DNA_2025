/**
 * Rate Limiter for AI Agent
 * Giới hạn số request để tránh tốn phí và abuse
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const defaultConfig: RateLimitConfig = {
  maxRequests: 10, // 10 requests
  windowMs: 60 * 1000, // per minute
};

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = defaultConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const key = identifier.toLowerCase();

  let record = rateLimitStore.get(key);

  // Reset if window expired
  if (!record || now > record.resetAt) {
    record = {
      count: 0,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, record);
  }

  // Check limit
  if (record.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt,
    };
  }

  // Increment count
  record.count++;
  rateLimitStore.set(key, record);

  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
    resetAt: record.resetAt,
  };
}

export function getRateLimitStatus(identifier: string): {
  remaining: number;
  resetAt: number;
} {
  const key = identifier.toLowerCase();
  const record = rateLimitStore.get(key);

  if (!record) {
    return {
      remaining: defaultConfig.maxRequests,
      resetAt: Date.now() + defaultConfig.windowMs,
    };
  }

  const now = Date.now();
  if (now > record.resetAt) {
    return {
      remaining: defaultConfig.maxRequests,
      resetAt: now + defaultConfig.windowMs,
    };
  }

  return {
    remaining: defaultConfig.maxRequests - record.count,
    resetAt: record.resetAt,
  };
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt + 60000) {
      // Keep for 1 minute after expiry
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Run every minute

