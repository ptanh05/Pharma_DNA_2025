/**
 * Request Context Middleware
 * Thêm request ID, user info, timing vào mỗi request
 */

import { NextRequest, NextResponse }from 'next/server';
import { v4 as uuidv4 }from 'uuid';
import { logRequest, logResponse, logSecurityEvent } from '@/lib/logger';

/**
 * Request context được attach vào request
 */
export interface RequestContext {
  requestId: string;
  startTime: number;
  userId?: string;
  email?: string;
  role?: string;
  ip: string;
  userAgent?: string;
  method: string;
  endpoint: string;
}

// Sử dụng AsyncLocalStorage để lưu context
import { AsyncLocalStorage }from 'async_hooks';

const requestStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Get current request context
 */
export function getRequestContext(): RequestContext | undefined {
  return requestStorage.getStore();
}

/**
 * Middleware để thêm request context
 */
export async function withRequestContext(
  handler: (req: NextRequest) => Promise<NextResponse>,
  req: NextRequest
): Promise<NextResponse> {
  // Tạo request ID
  const requestId = req.headers.get('X-Request-ID') || uuidv4();
  
  // Lấy thông tin từ request
  const ip = req.headers.get('x-forwarded-for') || 
            req.headers.get('x-real-ip') || 
            'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const method = req.method;
  const endpoint = req.nextUrl.pathname;
  
  const context: RequestContext = {
    requestId,
    startTime: Date.now(),
    ip,
    userAgent,
    method,
    endpoint,
  };

  // Log request
  logRequest({
    requestId,
    method,
    endpoint,
    ip,
    userAgent,
  });

  return requestStorage.run(context, async () => {
    try {
      // Thực thi handler
      const response = await handler(req);
      
      // Log response
      const duration = Date.now() - context.startTime;
      logResponse({
        requestId,
        statusCode: response.status,
        duration,
        endpoint,
        method,
        userId: context.userId,
      });

      // Attach request ID vào response headers
      const headers = new Headers(response.headers);
      headers.set('X-Request-ID', requestId);
      
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }catch (error: any) {
      // Log error
      const duration = Date.now() - context.startTime;
      logResponse({
        requestId,
        statusCode: 500,
        duration,
        endpoint,
        method,
        userId: context.userId,
        error: error.message,
      });

      // Log security event nếu là auth error
      if (error.message?.includes('UNAUTHORIZED') || error.message?.includes('FORBIDDEN')) {
        logSecurityEvent({
          requestId,
          event: 'Authorization Failure',
          userId: context.userId,
          action: method,
          resource: endpoint,
          result: 'denied',
          reason: error.message,
        });
      }

      throw error;
    }
  });
}

/**
 * Middleware to extract user context từ JWT token
 */
export async function extractUserContext(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return;
  }

  try {
    const token = authHeader.substring(7);
    // Decode token để lấy user info
    const parts = token.split('.');
    if (parts.length !== 3) return;

    const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const context = getRequestContext();
    
    if (context) {
      context.userId = decoded.userId;
      context.email = decoded.email;
      context.role = decoded.role;
    }
  }catch (error) {
    // Ignore decoding errors
  }
}
