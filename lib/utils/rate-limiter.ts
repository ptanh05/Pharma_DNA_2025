/**
 * Rate Limiter Utility
 * Implement rate limiting for API endpoints
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  private readonly defaultWindowMs = 60 * 1000; // 1 minute
  private readonly defaultMaxRequests = 100;

  /**
   * Check if request is allowed
   */
  isAllowed(
    key: string,
    maxRequests: number = this.defaultMaxRequests,
    windowMs: number = this.defaultWindowMs
  ): boolean {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now > entry.resetTime) {
      // Create new entry
      this.limits.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return true;
    }

    if (entry.count < maxRequests) {
      entry.count++;
      return true;
    }

    return false;
  }

  /**
   * Get remaining requests
   */
  getRemaining(
    key: string,
    maxRequests: number = this.defaultMaxRequests
  ): number {
    const entry = this.limits.get(key);
    if (!entry) return maxRequests;
    return Math.max(0, maxRequests - entry.count);
  }

  /**
   * Get reset time
   */
  getResetTime(key: string): number {
    const entry = this.limits.get(key);
    return entry?.resetTime || Date.now();
  }

  /**
   * Clear all limits
   */
  clear(): void {
    this.limits.clear();
  }
}

export const rateLimiter = new RateLimiter();

/**
 * Rate limit configs
 */
export const rateLimitConfigs = {
  read: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },
  write: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
  },
  admin: {
    maxRequests: 50,
    windowMs: 60 * 1000, // 1 minute
  },
  auth: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
};

