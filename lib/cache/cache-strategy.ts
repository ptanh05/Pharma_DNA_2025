/**
 * Caching Strategy
 * lib/cache/cache-strategy.ts
 */

import { SimpleCache } from "./simple-cache";

export const cacheStrategy = {
  // Cache NFT details for 5 minutes
  nftDetails: {
    ttl: 5 * 60 * 1000,
    key: (nftId: number) => `nft:${nftId}`,
  },

  // Cache user roles for 10 minutes
  userRole: {
    ttl: 10 * 60 * 1000,
    key: (address: string) => `role:${address}`,
  },

  // Cache analytics for 30 minutes
  analytics: {
    ttl: 30 * 60 * 1000,
    key: (period: string) => `analytics:${period}`,
  },

  // Cache lookup results for 1 minute
  lookup: {
    ttl: 1 * 60 * 1000,
    key: (batch: string) => `lookup:${batch}`,
  },
};

export async function getCachedOrFetch<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cache = new SimpleCache();
  
  // Try cache first
  const cached = cache.get<T>(key);
  if (cached) {
    return cached;
  }

  // Fetch and cache
  const data = await fetchFn();
  cache.set(key, data, ttl);
  return data;
}

