/**
 * Redis Cache Layer
 * Caching strategy để tăng tốc độ queries
 */

import Redis from 'ioredis';
import { logInfo, logError }from '@/lib/logger';

/**
 * Redis client
 */
let redisClient: Redis | null = null;

/**
 * Initialize Redis client
 */
export function initializeRedis(): Redis | null {
  if (!process.env.REDIS_URL) {
    logInfo('Redis not configured - skipping caching');
    return null;
  }

  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on('error', (err) => {
      logError('Redis connection error', err);
    });

    redisClient.on('connect', () => {
      logInfo('Redis connected');
    });

    redisClient.on('reconnecting', () => {
      logInfo('Redis reconnecting');
    });

    return redisClient;
  }catch (error) {
    logError('Failed to initialize Redis', error);
    return null;
  }
}

/**
 * Get Redis client
 */
export function getRedis(): Redis | null {
  if (!redisClient) {
    redisClient = initializeRedis();
  }
  return redisClient;
}

/**
 * Cache keys
 */
export const CACHE_KEYS = {
  // NFT cache
  NFT: (id: number) => `nft:${id}`,
  NFT_BATCH: (batchNumber: string) => `nft:batch:${batchNumber}`,
  NFT_MANUFACTURER: (address: string, page: number = 1) =>
    `nft:manufacturer:${address}:${page}`,

  // User cache
  USER: (id: string) => `user:${id}`,
  USER_ADDRESS: (address: string) => `user:address:${address}`,

  // Inventory cache
  DISTRIBUTOR_INVENTORY: (address: string, page: number = 1) =>
    `inventory:distributor:${address}:${page}`,
  PHARMACY_INVENTORY: (address: string, page: number = 1) =>
    `inventory:pharmacy:${address}:${page}`,

  // Stats cache
  DASHBOARD_STATS: (period: string) => `stats:dashboard:${period}`,
  NFT_STATS: () => 'stats:nft',
  USER_STATS: () => 'stats:users',

  // Public lookup
  PUBLIC_LOOKUP: (batchNumber: string) => `public:lookup:${batchNumber}`,

  // Transaction recovery
  TX_RECOVERY: (key: string) => `tx:recovery:${key}`,
};

/**
 * Cache TTLs (Time To Live)
 */
export const CACHE_TTLs = {
  SHORT: 5 * 60, // 5 minutes
  MEDIUM: 15 * 60, // 15 minutes
  LONG: 60 * 60, // 1 hour
  VERY_LONG: 24 * 60 * 60, // 24 hours
};

/**
 * Set cache value
 */
export async function setCache(
  key: string,
  value: any,
  ttl: number = CACHE_TTLs.MEDIUM
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.setex(key, ttl, JSON.stringify(value));
  }catch (error) {
    logError('Cache set error', error, { key });
  }
}

/**
 * Get cache value
 */
export async function getCache<T = any>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  }catch (error) {
    logError('Cache get error', error, { key });
    return null;
  }
}

/**
 * Delete cache value
 */
export async function deleteCache(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(key);
  }catch (error) {
    logError('Cache delete error', error, { key });
  }
}

/**
 * Delete cache pattern
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }catch (error) {
    logError('Cache pattern delete error', error, { pattern });
  }
}

/**
 * Cache invalidation helpers
 */
export const cacheInvalidation = {
  // Invalidate NFT caches
  async invalidateNFT(id: number, batchNumber?: string) {
    await deleteCache(CACHE_KEYS.NFT(id));
    if (batchNumber) {
      await deleteCache(CACHE_KEYS.NFT_BATCH(batchNumber));
    }
    // Invalidate all public lookup caches
    await deleteCachePattern('public:lookup:*');
    // Invalidate all stats
    await deleteCachePattern('stats:*');
  },

  // Invalidate inventory caches
  async invalidateDistributorInventory(address: string) {
    await deleteCachePattern(
      `inventory:distributor:${address}:*`
    );
    await deleteCachePattern('stats:*');
  },

  async invalidatePharmacyInventory(address: string) {
    await deleteCachePattern(
      `inventory:pharmacy:${address}:*`
    );
    await deleteCachePattern('stats:*');
  },

  // Invalidate user cache
  async invalidateUser(id: string, address?: string) {
    await deleteCache(CACHE_KEYS.USER(id));
    if (address) {
      await deleteCache(CACHE_KEYS.USER_ADDRESS(address));
    }
  },

  // Invalidate all caches
  async invalidateAll() {
    const redis = getRedis();
    if (!redis) return;

    try {
      await redis.flushdb();
      logInfo('All caches invalidated');
    }catch (error) {
      logError('Failed to invalidate all caches', error);
    }
  },
};

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const info = await redis.info('stats');
    return info;
  }catch (error) {
    logError('Failed to get cache stats', error);
    return null;
  }
}
