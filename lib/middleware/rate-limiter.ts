/**
 * Rate Limiting Middleware
 * Prevents spam and abuse for blockchain transactions
 */

import { Request, Response, NextFunction } from 'express';

// Configuration
interface RateLimitConfig {
    windowMs: number; // Time window in milliseconds
    maxRequests: number; // Max requests per window
    blockDurationMs: number; // How long to block after exceeding limit
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
}

// Store for rate limiting (use Redis in production)
interface RateLimitEntry {
    count: number;
    firstRequest: number;
    blockedUntil: number | null;
}

class MemoryStore {
    private store: Map<string, RateLimitEntry> = new Map();
    private cleanupInterval: NodeJS.Timeout;

    constructor(cleanupIntervalMs = 60000) {
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, cleanupIntervalMs);
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (entry.blockedUntil && entry.blockedUntil < now) {
                this.store.delete(key);
            } else if (entry.firstRequest < now - 3600000) { // Cleanup old entries after 1 hour
                this.store.delete(key);
            }
        }
    }

    get(key: string): RateLimitEntry | undefined {
        return this.store.get(key);
    }

    set(key: string, entry: RateLimitEntry): void {
        this.store.set(key, entry);
    }

    delete(key: string): boolean {
        return this.store.delete(key);
    }

    reset(): void {
        this.store.clear();
    }
}

export class RateLimiter {
    private store: MemoryStore;
    private config: RateLimitConfig;
    private defaultConfig: RateLimitConfig = {
        windowMs: 60000, // 1 minute
        maxRequests: 30,
        blockDurationMs: 300000, // 5 minutes
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
    };

    constructor(config: Partial<RateLimitConfig> = {}) {
        this.store = new MemoryStore();
        this.config = { ...this.defaultConfig, ...config };
    }

    /**
     * Check if request should be rate limited
     */
    check(key: string, isSuccess: boolean = true): {
        limited: boolean;
        remaining: number;
        resetTime: number;
        retryAfter: number | null;
    } {
        const now = Date.now();
        let entry = this.store.get(key);

        if (!entry) {
            entry = {
                count: isSuccess && this.config.skipSuccessfulRequests ? 0 : 1,
                firstRequest: now,
                blockedUntil: null,
            };
            this.store.set(key, entry);
        }

        // Check if blocked
        if (entry.blockedUntil && entry.blockedUntil > now) {
            return {
                limited: true,
                remaining: 0,
                resetTime: entry.blockedUntil,
                retryAfter: entry.blockedUntil - now,
            };
        }

        // Check if window expired
        if (now - entry.firstRequest > this.config.windowMs) {
            entry.count = isSuccess && this.config.skipSuccessfulRequests ? 0 : 1;
            entry.firstRequest = now;
            this.store.set(key, entry);
        }

        // Check rate limit
        const remaining = Math.max(0, this.config.maxRequests - entry.count);
        const resetTime = entry.firstRequest + this.config.windowMs;

        if (entry.count >= this.config.maxRequests) {
            // Block the user
            entry.blockedUntil = now + this.config.blockDurationMs;
            this.store.set(key, entry);

            return {
                limited: true,
                remaining: 0,
                resetTime,
                retryAfter: this.config.blockDurationMs,
            };
        }

        // Increment counter (skip if successful and configured to skip)
        if (!(isSuccess && this.config.skipSuccessfulRequests)) {
            entry.count++;
            this.store.set(key, entry);
        }

        return {
            limited: false,
            remaining,
            resetTime,
            retryAfter: null,
        };
    }

    /**
     * Express middleware for rate limiting
     */
    middleware() {
        return (req: Request, res: Response, next: NextFunction) => {
            // Use IP address as key
            const key = this.getClientKey(req);
            const result = this.check(key);

            // Set rate limit headers
            res.set({
                'X-RateLimit-Limit': String(this.config.maxRequests),
                'X-RateLimit-Remaining': String(result.remaining),
                'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
            });

            if (result.limited) {
                res.set('Retry-After', String(Math.ceil((result.retryAfter || 0) / 1000)));
                return res.status(429).json({
                    error: 'Too Many Requests',
                    message: 'Bạn đã thực hiện quá nhiều yêu cầu. Vui lòng thử lại sau.',
                    retryAfter: Math.ceil((result.retryAfter || 0) / 1000),
                });
            }

            next();
        };
    }

    /**
     * Get client key from request
     */
    private getClientKey(req: Request): string {
        // Try to get real IP from X-Forwarded-For header
        const forwarded = req.headers['x-forwarded-for'];
        const ip = forwarded ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]) : req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'] || '';

        // Combine IP and user agent for more accurate tracking
        return `${ip}-${userAgent.substring(0, 50)}`;
    }

    /**
     * Reset rate limit for a specific key
     */
    reset(key: string): void {
        this.store.delete(key);
    }

    /**
     * Reset all rate limits
     */
    resetAll(): void {
        this.store.reset();
    }

    /**
     * Get current status for a key
     */
    getStatus(key: string): RateLimitEntry | undefined {
        return this.store.get(key);
    }
}

// Export different rate limiters for different endpoints
export const apiRateLimiter = new RateLimiter({
    windowMs: 60000, // 1 minute
    maxRequests: 60, // 60 requests per minute
});

export const writeRateLimiter = new RateLimiter({
    windowMs: 60000, // 1 minute
    maxRequests: 30, // 30 writes per minute
    blockDurationMs: 300000, // 5 minute block
});

export const nftRateLimiter = new RateLimiter({
    windowMs: 3600000, // 1 hour
    maxRequests: 10, // 10 NFT operations per hour
    blockDurationMs: 3600000, // 1 hour block
});

export const adminRateLimiter = new RateLimiter({
    windowMs: 300000, // 5 minutes
    maxRequests: 10, // 10 admin operations per 5 minutes
    blockDurationMs: 900000, // 15 minute block
});

export default RateLimiter;
