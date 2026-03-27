/**
 * Error Handler Utility
 * Centralized error handling for API routes
 */

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: any;
  userMessage?: string;
}

export class AppError extends Error implements ApiError {
  code: string;
  statusCode: number;
  details?: any;
  userMessage?: string;

  constructor(
    message: string,
    code: string = "INTERNAL_ERROR",
    statusCode: number = 500,
    details?: any,
    userMessage?: string
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.userMessage = userMessage;
    this.name = "AppError";
  }
}

// Common error types
export const ErrorTypes = {
  VALIDATION_ERROR: {
    code: "VALIDATION_ERROR",
    statusCode: 400,
    message: "Validation failed",
  },
  NOT_FOUND: {
    code: "NOT_FOUND",
    statusCode: 404,
    message: "Resource not found",
  },
  UNAUTHORIZED: {
    code: "UNAUTHORIZED",
    statusCode: 401,
    message: "Unauthorized access",
  },
  FORBIDDEN: {
    code: "FORBIDDEN",
    statusCode: 403,
    message: "Access forbidden",
  },
  CONFLICT: {
    code: "CONFLICT",
    statusCode: 409,
    message: "Resource conflict",
  },
  RATE_LIMIT: {
    code: "RATE_LIMIT",
    statusCode: 429,
    message: "Too many requests",
  },
  DATABASE_ERROR: {
    code: "DATABASE_ERROR",
    statusCode: 500,
    message: "Database error",
  },
  BLOCKCHAIN_ERROR: {
    code: "BLOCKCHAIN_ERROR",
    statusCode: 500,
    message: "Blockchain error",
  },
  INTERNAL_ERROR: {
    code: "INTERNAL_ERROR",
    statusCode: 500,
    message: "Internal server error",
  },
};

/**
 * Parse error and return standardized error object
 */
export function parseError(error: any): ApiError {
  // Handle string errors
  if (typeof error === 'string') {
    const errLower = error.toLowerCase();
    if (error.includes('User rejection') || error.includes('CN:-4005') || error.includes('rejected')) {
      return {
        code: 'USER_REJECTED',
        message: 'User rejection',
        statusCode: 400,
        userMessage: 'Bạn đã từ chối ký transaction trên ví Sui.',
        details: { originalError: error },
      };
    }
    if (errLower.includes('502') || errLower.includes('503') || errLower.includes('timeout') ||
        errLower.includes('bad gateway') || errLower.includes('service unavailable')) {
      return {
        code: 'BLOCKCHAIN_NETWORK_ERROR',
        message: error,
        statusCode: 503,
        userMessage: 'Sui blockchain RPC server đang bận hoặc tạm thời ngưng hoạt động. Vui lòng thử lại sau vài giây.',
        details: { originalError: error },
      };
    }
    return {
      code: ErrorTypes.INTERNAL_ERROR.code,
      message: error,
      statusCode: ErrorTypes.INTERNAL_ERROR.statusCode,
      details: { originalError: error },
    };
  }

  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
    };
  }

  // Handle wallet rejection errors
  const errorMessage = error?.message || error?.toString() || '';
  if (errorMessage.includes('User rejection') || errorMessage.includes('CN:-4005') || errorMessage.includes('rejected')) {
    return {
      code: 'USER_REJECTED',
      message: 'User rejection',
      statusCode: 400,
      userMessage: 'Bạn đã từ chối ký transaction trên ví Sui.',
      details: { originalError: errorMessage },
    };
  }

  if (error instanceof Error) {
    // Database errors
    if (error.message.includes("ECONNREFUSED")) {
      return {
        code: ErrorTypes.DATABASE_ERROR.code,
        message: "Database connection failed",
        userMessage: "Không thể kết nối đến database. Vui lòng thử lại sau.",
        statusCode: ErrorTypes.DATABASE_ERROR.statusCode,
        details: { originalError: error.message },
      };
    }

    // Blockchain errors
    if (error.message.includes("RPC")) {
      return {
        code: ErrorTypes.BLOCKCHAIN_ERROR.code,
        message: "Blockchain RPC error",
        statusCode: ErrorTypes.BLOCKCHAIN_ERROR.statusCode,
        details: { originalError: error.message },
      };
    }

    // Network/RPC 502/503 errors
    const msgLower = error.message.toLowerCase();
    if (msgLower.includes('502') || msgLower.includes('503') || msgLower.includes('504') ||
        msgLower.includes('timeout') || msgLower.includes('econnreset') || msgLower.includes('enotfound') ||
        msgLower.includes('bad gateway') || msgLower.includes('service unavailable') ||
        msgLower.includes('gateway timeout') || msgLower.includes('network error')) {
      return {
        code: 'BLOCKCHAIN_NETWORK_ERROR',
        message: error.message,
        statusCode: 503,
        userMessage: 'Sui blockchain RPC server đang bận hoặc tạm thời ngưng hoạt động. Vui lòng thử lại sau vài giây.',
        details: { originalError: error.message },
      };
    }

    // Move contract abort errors
    // Error code 2 = Only manufacturer can mint
    if (error.message.includes("MoveAbort") || error.message.includes("MoveLocation")) {
      let userMsg = "Smart contract error";
      if (error.message.includes(", 2)") || error.message.includes("function: 8")) {
        userMsg = "Tài khoản của bạn chưa được cấp quyền MANUFACTURER trên blockchain. Vui lòng liên hệ admin.";
      } else if (error.message.includes(", 1)")) {
        userMsg = "Bạn không có quyền thực hiện thao tác này.";
      } else if (error.message.includes(", 4)")) {
        userMsg = "Sản phẩm đã hết hạn.";
      } else if (error.message.includes(", 5)") || error.message.includes(", 6)")) {
        userMsg = "Không được phép chuyển NFT theo luồng này.";
      }
      return {
        code: ErrorTypes.BLOCKCHAIN_ERROR.code,
        message: userMsg,
        userMessage: userMsg,
        statusCode: ErrorTypes.BLOCKCHAIN_ERROR.statusCode,
        details: { originalError: error.message },
      };
    }

    return {
      code: ErrorTypes.INTERNAL_ERROR.code,
      message: error.message,
      statusCode: ErrorTypes.INTERNAL_ERROR.statusCode,
      details: { originalError: error.message },
    };
  }

  return {
    code: ErrorTypes.INTERNAL_ERROR.code,
    message: "Unknown error occurred",
    statusCode: ErrorTypes.INTERNAL_ERROR.statusCode,
    details: { error },
  };
}

/**
 * Log error with context
 */
export function logError(
  error: any,
  context: string,
  additionalInfo?: any
): void {
  const parsedError = parseError(error);
  console.error(`[${context}] Error:`, {
    code: parsedError.code,
    message: parsedError.message,
    statusCode: parsedError.statusCode,
    details: parsedError.details,
    additionalInfo,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => 
          setTimeout(resolve, initialDelay * Math.pow(2, i))
        );
      }
    }
  }
  
  throw lastError!;
}

/**
 * Create error response
 */
export function createErrorResponse(error: any, context: string) {
  logError(error, context);
  const parsedError = parseError(error);
  return {
    success: false,
    error: {
      code: parsedError.code,
      message: parsedError.message,
    },
    statusCode: parsedError.statusCode,
  };
  }
