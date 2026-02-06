/**
 * Query Result Caching
 * lib/db/query-cache.ts
 */

import { SimpleCache } from "@/lib/cache/simple-cache";

const queryCache = new SimpleCache();

export async function cachedQuery<T>(
  pool: any,
  query: string,
  params: any[],
  ttl: number = 5 * 60 * 1000
): Promise<T> {
  const cacheKey = `query:${query}:${JSON.stringify(params)}`;
  
  // Try cache
  const cached = queryCache.get<T>(cacheKey);
  if (cached) {
    return cached;
  }

  // Execute query
  const result = await pool.query(query, params);
  const data = result.rows as T;

  // Cache result
  queryCache.set(cacheKey, data, ttl);
  return data;
}

export function invalidateQueryCache(pattern: string) {
  // Clear cache entries matching pattern
  queryCache.clear();
}

