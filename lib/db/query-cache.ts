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
): Promise<{ rows: T[] }> {
  const cacheKey = `query:${query}:${JSON.stringify(params)}`;

  // Try cache
  const cached = queryCache.get<{ rows: T[] }>(cacheKey);
  if (cached) {
    return cached;
  }

  // Execute query
  const result = await pool.query(query, params);

  // Cache result — return same shape as pool.query: { rows: T[] }
  const data: { rows: T[] } = { rows: result.rows as T[] };
  queryCache.set(cacheKey, data, ttl);
  return data;
}

export function invalidateQueryCache(pattern: string) {
  // Clear cache entries matching pattern
  queryCache.clear();
}

