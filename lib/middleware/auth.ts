/**
 * Authorization Middleware
 * Kiểm tra xác thực và phân quyền user
 */

import { NextRequest, NextResponse }from 'next/server';
import { verifyToken, extractTokenFromHeader }from '@/lib/auth/jwt';
import type { UserPayload }from '@/lib/auth/jwt';

/**
 * Custom error classes
 */
export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Trích xuất user từ request
 * Kiểm tra Authorization header và verify JWT
 */
export async function extractUser(req: NextRequest): Promise<UserPayload> {
  const authHeader = req.headers.get('Authorization');
  const token = extractTokenFromHeader(authHeader ?? undefined);

  if (!token) {
    throw new UnauthorizedError('Missing authorization token');
  }

  try {
    const user = await verifyToken(token);
    return user;
  }catch (error: any) {
    if (error.message?.includes('expired')) {
      throw new UnauthorizedError('Token has expired');
    }
    throw new UnauthorizedError('Invalid token');
  }
}

/**
 * Kiểm tra xem user có role cụ thể không
 * Trả về user nếu hợp lệ, throw error nếu không
 */
export async function authorizeRole(
  req: NextRequest,
  ...allowedRoles: Array<UserPayload['role']>
): Promise<UserPayload> {
  const user = await extractUser(req);

  // Check nếu user role nằm trong allowed roles
  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError(
      `Role '${user.role}' is not authorized to access this resource. Allowed roles: ${allowedRoles.join(', ')}`
    );
  }

  return user;
}

/**
 * Middleware wrapper để protect routes
 * Tự động handle errors và return JSON responses
 */
export function withAuth(handler: (req: NextRequest, ...args: any[]) => Promise<Response>) {
  return async (req: NextRequest, ...args: any[]) => {
    try {
      const user = await extractUser(req);
      // Attach user to request context
      (req as any).user = user;
      return await handler(req, ...args);
    }catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          { error: error.message },
          { status: 401 }
        );
      }
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Middleware wrapper để protect routes với specific roles
 * Tự động handle errors và return JSON responses
 */
export function withAuthRole(
  handler: (req: NextRequest, ...args: any[]) => Promise<Response>,
  ...allowedRoles: Array<UserPayload['role']>
) {
  return async (req: NextRequest, ...args: any[]) => {
    try {
      const user = await authorizeRole(req, ...allowedRoles);
      // Attach user to request context
      (req as any).user = user;
      return await handler(req, ...args);
    }catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          { error: error.message },
          { status: 401 }
        );
      }
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}
