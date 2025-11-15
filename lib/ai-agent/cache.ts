/**
 * Cache for AI Agent Results
 * Cache kết quả để tránh gọi lại và tiết kiệm cost
 */

interface CacheEntry {
  result: any;
  timestamp: number;
  expiresAt: number;
}

const cacheStore = new Map<string, CacheEntry>();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export function getCache(key: string): any | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }

  return entry.result;
}

export function setCache(key: string, value: any, ttl: number = DEFAULT_TTL): void {
  const now = Date.now();
  cacheStore.set(key, {
    result: value,
    timestamp: now,
    expiresAt: now + ttl,
  });
}

export function generateCacheKey(task: string, context?: any): string {
  const contextStr = context ? JSON.stringify(context) : "";
  return `agent_${Buffer.from(task + contextStr).toString("base64").slice(0, 50)}`;
}

export function clearCache(pattern?: string): number {
  if (!pattern) {
    const count = cacheStore.size;
    cacheStore.clear();
    return count;
  }

  let count = 0;
  for (const key of cacheStore.keys()) {
    if (key.includes(pattern)) {
      cacheStore.delete(key);
      count++;
    }
  }
  return count;
}

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cacheStore.entries()) {
    if (now > entry.expiresAt) {
      cacheStore.delete(key);
    }
  }
}, 60000); // Run every minute

