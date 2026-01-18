/**
 * API Helper Functions
 * Common utilities for API routes
 */

import { NextRequest, NextResponse } from "next/server";
import { performanceMonitor } from "./performance";
import cache from "@/lib/cache/simple-cache";
import { getCacheKey } from "@/lib/cache/simple-cache";

/**
 * Create success response
 */
export function successResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(message && { message }),
    },
    { status }
  );
}

/**
 * Create error response
 */
export function errorResponse(
  error: string,
  details?: any,
  status: number = 400
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(details && { details }),
    },
    { status }
  );
}

/**
 * Track API performance
 */
export async function trackAPI<T>(
  name: string,
  handler: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  return performanceMonitor.track(`api:${name}`, handler, metadata);
}

/**
 * Cache API response
 */
export async function cachedAPI<T>(
  key: string,
  handler: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const cacheKey = getCacheKey("api", key);
  const cached = cache.get<T>(cacheKey);
  
  if (cached !== null) {
    return cached;
  }

  const result = await handler();
  cache.set(cacheKey, result, ttl);
  
  return result;
}

/**
 * Handle API errors consistently
 */
export function handleAPIError(error: unknown): NextResponse {
  console.error("API Error:", error);
  
  if (error instanceof Error) {
    return errorResponse(
      error.message || "Internal server error",
      process.env.NODE_ENV === "development" ? error.stack : undefined,
      500
    );
  }

  return errorResponse("Internal server error", undefined, 500);
}

/**
 * Parse pagination params from request
 */
export function parsePaginationParams(req: NextRequest): {
  page: number;
  limit: number;
  offset: number;
} {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "10", 10)));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Parse search and filter params
 */
export function parseFilterParams(req: NextRequest): {
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
} {
  const url = new URL(req.url);
  const search = url.searchParams.get("search") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const sortBy = url.searchParams.get("sortBy") || undefined;
  const sortOrder = (url.searchParams.get("sortOrder") || "desc") as "asc" | "desc";

  return { search, status, sortBy, sortOrder };
}

