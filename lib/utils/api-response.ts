/**
 * API Response Formatter Utility
 * Centralized response formatting for all API routes
 */

import { NextResponse } from "next/server";
import { parseError } from "./error-handler";

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    timestamp: string;
    version: string;
  };
}

/**
 * Create success response
 */
export function createSuccessResponse<T>(
  data: T,
  statusCode: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        version: "1.0",
      },
    },
    { status: statusCode }
  );
}

/**
 * Create error response
 */
export function createErrorResponse(
  error: any,
  context: string = "API_ERROR"
): NextResponse<ApiResponse> {
  const parsedError = parseError(error);
  
  console.error(`[${context}]`, {
    code: parsedError.code,
    message: parsedError.message,
    statusCode: parsedError.statusCode,
  });

  return NextResponse.json(
    {
      success: false,
      error: {
        code: parsedError.code,
        message: parsedError.message,
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: "1.0",
      },
    },
    { status: parsedError.statusCode }
  );
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  statusCode: number = 200
): NextResponse<ApiResponse<{ items: T[]; pagination: any }>> {
  return NextResponse.json(
    {
      success: true,
      data: {
        items: data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: "1.0",
      },
    },
    { status: statusCode }
  );
}

