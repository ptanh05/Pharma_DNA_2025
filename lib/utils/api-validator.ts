/**
 * API Request Validator Utility
 * Centralized request validation for all API routes
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { AppError, ErrorTypes }from "./error-handler";

/**
 * Validate request body with Zod schema
 */
export async function validateRequestBody<T>(
  req: NextRequest,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const messages = parsed.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      throw new AppError(
        `Validation failed: ${messages}`,
        ErrorTypes.VALIDATION_ERROR.code,
        ErrorTypes.VALIDATION_ERROR.statusCode
      );
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof z.ZodError) {
      const messages = error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      throw new AppError(
        `Validation failed: ${messages}`,
        ErrorTypes.VALIDATION_ERROR.code,
        ErrorTypes.VALIDATION_ERROR.statusCode
      );
    }
    throw error;
  }
}

/**
 * Validate query parameters with Zod schema
 */
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodSchema<T, any, any>
): T {
  try {
    const params = Object.fromEntries(searchParams);
    const parsed = schema.safeParse(params);
    if (!parsed.success) {
      const messages = parsed.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      throw new AppError(
        `Query validation failed: ${messages}`,
        ErrorTypes.VALIDATION_ERROR.code,
        ErrorTypes.VALIDATION_ERROR.statusCode
      );
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof z.ZodError) {
      const messages = error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      throw new AppError(
        `Query validation failed: ${messages}`,
        ErrorTypes.VALIDATION_ERROR.code,
        ErrorTypes.VALIDATION_ERROR.statusCode
      );
    }
    throw error;
  }
}

/**
 * Validate required headers
 */
export function validateHeaders(
  req: NextRequest,
  requiredHeaders: string[]
): Record<string, string> {
  const headers: Record<string, string> = {};
  
  for (const header of requiredHeaders) {
    const value = req.headers.get(header);
    if (!value) {
      throw new AppError(
        `Missing required header: ${header}`,
        ErrorTypes.VALIDATION_ERROR.code,
        ErrorTypes.VALIDATION_ERROR.statusCode
      );
    }
    headers[header] = value;
  }
  
  return headers;
}

/**
 * Get client IP address
 */
export function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

