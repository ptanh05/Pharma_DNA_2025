/**
 * Rate Limiting Middleware for Next.js App Router
 * Uses Web API Request/Response instead of Express
 */

// Configuration
interface RateLimitConfig {
    windowMs: number; // Time window in milliseconds
    maxRequests: number; // Max requests per window
    blockDurationMs: number; // How long to block after exceeding limit
}

interface RateLimitEntry {
    count: number;
    firstRequest: number;
    blockedUntil: number | null;
}

class MemoryStore {
    private store = new Map<string, RateLimitEntry>();

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
    private config: Required<RateLimitConfig>;
    private defaultConfig = {
        windowMs: 60000, // 1 minute
        maxRequests: 60,
        blockDurationMs: 300000, // 5 minutes
    };

    constructor(config: Partial<RateLimitConfig> = {}) {
        this.store = new MemoryStore();
        this.config = { ...this.defaultConfig, ...config };
    }

    check(key: string): {
        limited: boolean;
        remaining: number;
        resetTime: number;
        retryAfter: number | null;
    } {
        const now = Date.now();
        let entry = this.store.get(key);

        if (!entry) {
            entry = { count: 1, firstRequest: now, blockedUntil: null };
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
            entry.count = 1;
            entry.firstRequest = now;
            entry.blockedUntil = null;
            this.store.set(key, entry);
        }

        const remaining = Math.max(0, this.config.maxRequests - entry.count);
        const resetTime = entry.firstRequest + this.config.windowMs;

        if (entry.count >= this.config.maxRequests) {
            entry.blockedUntil = now + this.config.blockDurationMs;
            this.store.set(key, entry);
            return {
                limited: true,
                remaining: 0,
                resetTime,
                retryAfter: this.config.blockDurationMs,
            };
        }

        entry.count++;
        this.store.set(key, entry);

        return {
            limited: false,
            remaining: remaining - 1,
            resetTime,
            retryAfter: null,
        };
    }

    /**
     * Get client key from NextRequest
     */
    getClientKey(req: Request): string {
        const forwarded = req.headers.get('x-forwarded-for');
        const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
        const userAgent = req.headers.get('user-agent') || '';
        return `${ip}-${userAgent.substring(0, 50)}`;
    }

    reset(key: string): void {
        this.store.delete(key);
    }

    resetAll(): void {
        this.store.reset();
    }

    getStatus(key: string): RateLimitEntry | undefined {
        return this.store.get(key);
    }
}

// Export different rate limiters for different endpoints
export const apiRateLimiter = new RateLimiter({
    windowMs: 60000,
    maxRequests: 60,
});

export const writeRateLimiter = new RateLimiter({
    windowMs: 60000,
    maxRequests: 30,
    blockDurationMs: 300000,
});

export const nftRateLimiter = new RateLimiter({
    windowMs: 3600000,
    maxRequests: 10,
    blockDurationMs: 3600000,
});

export const adminRateLimiter = new RateLimiter({
    windowMs: 300000,
    maxRequests: 10,
    blockDurationMs: 900000,
});

export default RateLimiter;
