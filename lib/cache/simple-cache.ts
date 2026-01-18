/**
 * Simple In-Memory Cache
 * For development and small-scale deployments
 * For production, use Redis or similar
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SimpleCache {
  private store: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 5 * 60 * 1000; // 5 minutes default

  /**
   * Set cache entry
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.store.set(key, { data, expiresAt });
  }

  /**
   * Get cache entry
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Delete cache entry
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Clean expired entries
   */
  clean(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get cache stats
   */
  getStats(): { size: number; keys: string[] } {
    this.clean(); // Clean before stats
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
    };
  }
}

// Singleton instance
const cache = new SimpleCache();

// Clean expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    cache.clean();
  }, 5 * 60 * 1000);
}

export default cache;

/**
 * Cache helper functions
 */
export function getCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.join(":")}`;
}

/**
 * Cache decorator for async functions
 */
export function cached<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyGenerator: (...args: Parameters<T>) => string,
  ttl?: number
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const key = keyGenerator(...args);
    
    // Check cache
    const cached = cache.get<Awaited<ReturnType<T>>>(key);
    if (cached !== null) {
      return cached as ReturnType<T>;
    }

    // Call function
    const result = await fn(...args);
    
    // Cache result
    cache.set(key, result, ttl);
    
    return result;
  }) as T;
}

