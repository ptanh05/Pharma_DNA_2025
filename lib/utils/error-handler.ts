/**
 * Error Handler Utility
 * Centralized error handling for API routes
 */

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: any;
}

export class AppError extends Error implements ApiError {
  code: string;
  statusCode: number;
  details?: any;

  constructor(
    message: string,
    code: string = "INTERNAL_ERROR",
    statusCode: number = 500,
    details?: any
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
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
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    // Database errors
    if (error.message.includes("ECONNREFUSED")) {
    return {
        code: ErrorTypes.DATABASE_ERROR.code,
        message: "Database connection failed",
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

    // Move contract abort errors
    // Error code 2 = Only manufacturer can mint
    if (error.message.includes("MoveAbort") || error.message.includes("MoveLocation")) {
      let userMessage = "Smart contract error";
      if (error.message.includes(", 2)") || error.message.includes("function: 8")) {
        userMessage = "MoveAbort(2): Tài khoản của bạn chưa được cấp quyền MANUFACTURER trên blockchain. Vui lòng liên hệ admin.";
      } else if (error.message.includes(", 1)")) {
        userMessage = "MoveAbort(1): Bạn không có quyền thực hiện thao tác này.";
      } else if (error.message.includes(", 4)")) {
        userMessage = "MoveAbort(4): Sản phẩm đã hết hạn.";
      } else if (error.message.includes(", 5)") || error.message.includes(", 6)")) {
        userMessage = "MoveAbort(5/6): Không được phép chuyển NFT theo luồng này.";
      }
      return {
        code: ErrorTypes.BLOCKCHAIN_ERROR.code,
        message: userMessage,
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
