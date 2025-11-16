/**
 * Rate Limiter for AI Agent
 * Giới hạn số lượng requests để tránh abuse và kiểm soát cost
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
  firstRequestAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Default rate limits
const DEFAULT_LIMITS = {
  requestsPerMinute: 10,
  requestsPerHour: 100,
  requestsPerDay: 1000,
};

// Custom limits per user type (if needed)
const CUSTOM_LIMITS: Record<string, typeof DEFAULT_LIMITS> = {
  admin: {
    requestsPerMinute: 30,
    requestsPerHour: 500,
    requestsPerDay: 5000,
  },
  manufacturer: {
    requestsPerMinute: 20,
    requestsPerHour: 200,
    requestsPerDay: 2000,
  },
};

/**
 * Get rate limit configuration for a key
 */
function getRateLimitConfig(key: string): typeof DEFAULT_LIMITS {
  // Check if key matches a custom limit pattern
  for (const [pattern, limits] of Object.entries(CUSTOM_LIMITS)) {
    if (key.includes(pattern)) {
      return limits;
    }
  }
  return DEFAULT_LIMITS;
}

/**
 * Check rate limit for a key
 */
export function checkRateLimit(key: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
} {
  const config = getRateLimitConfig(key);
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const hour = Math.floor(now / 3600000);
  const day = Math.floor(now / 86400000);

  // Get or create entry
  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = {
      count: 0,
      resetAt: now + 60000, // 1 minute default
      firstRequestAt: now,
    };
    rateLimitStore.set(key, entry);
  }

  // Check per-minute limit
  const minuteKey = `${key}_minute_${minute}`;
  const minuteEntry = rateLimitStore.get(minuteKey) || {
    count: 0,
    resetAt: (minute + 1) * 60000,
    firstRequestAt: now,
  };

  if (minuteEntry.count >= config.requestsPerMinute) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: minuteEntry.resetAt,
      limit: config.requestsPerMinute,
    };
  }

  // Check per-hour limit
  const hourKey = `${key}_hour_${hour}`;
  const hourEntry = rateLimitStore.get(hourKey) || {
    count: 0,
    resetAt: (hour + 1) * 3600000,
    firstRequestAt: now,
  };

  if (hourEntry.count >= config.requestsPerHour) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: hourEntry.resetAt,
      limit: config.requestsPerHour,
    };
  }

  // Check per-day limit
  const dayKey = `${key}_day_${day}`;
  const dayEntry = rateLimitStore.get(dayKey) || {
    count: 0,
    resetAt: (day + 1) * 86400000,
    firstRequestAt: now,
  };

  if (dayEntry.count >= config.requestsPerDay) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: dayEntry.resetAt,
      limit: config.requestsPerDay,
    };
  }

  // Increment counters
  minuteEntry.count++;
  hourEntry.count++;
  dayEntry.count++;
  rateLimitStore.set(minuteKey, minuteEntry);
  rateLimitStore.set(hourKey, hourEntry);
  rateLimitStore.set(dayKey, dayEntry);

  return {
    allowed: true,
    remaining: Math.min(
      config.requestsPerMinute - minuteEntry.count,
      config.requestsPerHour - hourEntry.count,
      config.requestsPerDay - dayEntry.count
    ),
    resetAt: Math.min(minuteEntry.resetAt, hourEntry.resetAt, dayEntry.resetAt),
    limit: config.requestsPerMinute,
  };
}

/**
 * Get rate limit status without incrementing
 */
export function getRateLimitStatus(key: string): {
  remaining: number;
  resetAt: number;
  limit: number;
} {
  const config = getRateLimitConfig(key);
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const hour = Math.floor(now / 3600000);
  const day = Math.floor(now / 86400000);

  const minuteKey = `${key}_minute_${minute}`;
  const hourKey = `${key}_hour_${hour}`;
  const dayKey = `${key}_day_${day}`;

  const minuteEntry = rateLimitStore.get(minuteKey);
  const hourEntry = rateLimitStore.get(hourKey);
  const dayEntry = rateLimitStore.get(dayKey);

  const minuteCount = minuteEntry?.count || 0;
  const hourCount = hourEntry?.count || 0;
  const dayCount = dayEntry?.count || 0;

  const remaining = Math.min(
    config.requestsPerMinute - minuteCount,
    config.requestsPerHour - hourCount,
    config.requestsPerDay - dayCount
  );

  const resetAt = Math.min(
    minuteEntry?.resetAt || (minute + 1) * 60000,
    hourEntry?.resetAt || (hour + 1) * 3600000,
    dayEntry?.resetAt || (day + 1) * 86400000
  );

  return {
    remaining: Math.max(0, remaining),
    resetAt,
    limit: config.requestsPerMinute,
  };
}

/**
 * Reset rate limit for a key
 */
export function resetRateLimit(key: string): void {
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const hour = Math.floor(now / 3600000);
  const day = Math.floor(now / 86400000);

  rateLimitStore.delete(`${key}_minute_${minute}`);
  rateLimitStore.delete(`${key}_hour_${hour}`);
  rateLimitStore.delete(`${key}_day_${day}`);
  rateLimitStore.delete(key);
}

/**
 * Cleanup old entries periodically
 * Note: setInterval doesn't work in Vercel serverless
 * Cleanup happens on-demand instead
 */
if (typeof process !== "undefined" && process.env.VERCEL !== "1") {
  setInterval(() => {
    const now = Date.now();
    const cutoff = now - 86400000 * 2; // 2 days ago

    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.firstRequestAt < cutoff) {
        rateLimitStore.delete(key);
      }
    }
  }, 3600000); // Run every hour
}

// Cleanup function for serverless (call on-demand)
export function cleanupRateLimit(): void {
  const now = Date.now();
  const cutoff = now - 86400000 * 2; // 2 days ago

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.firstRequestAt < cutoff) {
      rateLimitStore.delete(key);
    }
  }
}
