/**
 * Validation Middleware
 * Middleware functions for request validation
 */

import { z, ZodSchema } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Validate request body with Zod schema
 */
export async function validateRequest<T>(
  data: unknown,
  schema: ZodSchema<T>
): Promise<T> {
  try {
    return await schema.parseAsync(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));
      throw new ValidationError('Validation failed', errors);
    }
    throw error;
  }
}

/**
 * Validation Error Class
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: Array<{ path: string; message: string }>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Create validation middleware for Next.js API routes
 */
export function createValidationMiddleware<T>(schema: ZodSchema<T>) {
  return async (req: NextRequest): Promise<{ data: T } | NextResponse> => {
    try {
      const body = await req.json();
      const validated = await validateRequest(body, schema);
      return { data: validated };
    } catch (error) {
      if (error instanceof ValidationError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            details: error.errors,
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
        },
        { status: 400 }
      );
    }
  };
}

