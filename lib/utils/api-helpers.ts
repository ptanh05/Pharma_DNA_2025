/**
 * API Helper Utilities
 * Common functions for API routes
 */

import { NextResponse } from "next/server";
import { logError, parseError }from "./error-handler";

/**
 * Success response
 */
export function successResponse(data: any, statusCode: number = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status: statusCode }
  );
}

/**
 * Error response
 */
export function errorResponse(error: any, statusCode: number = 500) {
  const parsedError = parseError(error);
  return NextResponse.json(
    {
      success: false,
      error: {
        code: parsedError.code,
        message: parsedError.message,
      },
    },
    { status: statusCode }
  );
}

/**
 * Validation error response
 */
export function validationErrorResponse(message: string) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message,
      },
    },
    { status: 400 }
  );
}

/**
 * Track API call
 */
export async function trackAPI<T>(
  endpoint: string,
  handler: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await handler();
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logError(error, `API: ${endpoint}`, { duration });
    throw error;
  }
}

/**
 * Handle API error
 */
export function handleAPIError(error: any, endpoint: string) {
  logError(error, `API: ${endpoint}`);
  const parsedError = parseError(error);
  return errorResponse(error, parsedError.statusCode);
}
