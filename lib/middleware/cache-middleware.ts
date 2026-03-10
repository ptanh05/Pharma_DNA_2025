/**
 * API Response Caching Middleware
 * lib/middleware/cache-middleware.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { SimpleCache } from "@/lib/cache/simple-cache";

const cache = new SimpleCache();

export function withCaching(ttl: number = 5 * 60 * 1000) {
  return async (handler: (req: NextRequest) => Promise<Response>) => {
    return async (req: NextRequest) => {
      // Only cache GET requests
      if (req.method !== "GET") {
        return handler(req);
      }

      const cacheKey = `${req.method}:${req.url}`;
      const cached = cache.get(cacheKey);

      if (cached) {
        return new NextResponse(cached, {
          headers: { "X-Cache": "HIT" },
        });
      }

      const response = await handler(req);
      const body = await response.clone().text();

      cache.set(cacheKey, body, ttl);

      return new NextResponse(body, {
        ...response,
        headers: {
          ...response.headers,
          "X-Cache": "MISS",
        },
      });
    };
  };
}

