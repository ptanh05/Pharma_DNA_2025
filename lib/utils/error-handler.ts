/**
 * Error Handler Utilities
 * Centralized error handling and user-friendly error messages
 */

import { parseSuiError } from "@/lib/blockchain/errors-sui";

export interface ErrorDetails {
  message: string;
  userMessage: string;
  code?: string;
  retryable?: boolean;
  action?: string;
}

/**
 * Parse error and return user-friendly message
 */
export function parseError(error: unknown): ErrorDetails {
  // Handle Error objects
  if (error instanceof Error) {
    return parseErrorObject(error);
  }

  // Handle string errors
  if (typeof error === "string") {
    return {
      message: error,
      userMessage: getUserFriendlyMessage(error),
      retryable: isRetryableError(error),
    };
  }

  // Handle unknown errors
  return {
    message: "Unknown error occurred",
    userMessage: "Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.",
    retryable: false,
  };
}

/**
 * Parse Error object
 */
function parseErrorObject(error: Error): ErrorDetails {
  const message = error.message || error.toString();
  const userMessage = getUserFriendlyMessage(message);
  const retryable = isRetryableError(message);

  // Check for Sui-specific errors
  if (message.includes("Sui") || message.includes("transaction") || message.includes("blockchain")) {
    const suiError = parseSuiError(error);
    return {
      message: suiError,
      userMessage: getSuiUserFriendlyMessage(suiError),
      retryable: retryable,
      code: extractErrorCode(message),
    };
  }

  // Check for network errors
  if (message.includes("fetch") || message.includes("network") || message.includes("ECONNREFUSED")) {
    return {
      message,
      userMessage: "Lỗi kết nối mạng. Vui lòng kiểm tra kết nối internet và thử lại.",
      retryable: true,
      code: "NETWORK_ERROR",
    };
  }

  // Check for validation errors
  if (message.includes("validation") || message.includes("invalid") || message.includes("required")) {
    return {
      message,
      userMessage: `Dữ liệu không hợp lệ: ${userMessage}`,
      retryable: false,
      code: "VALIDATION_ERROR",
    };
  }

  // Check for permission errors
  if (message.includes("permission") || message.includes("unauthorized") || message.includes("forbidden")) {
    return {
      message,
      userMessage: "Bạn không có quyền thực hiện thao tác này. Vui lòng liên hệ admin.",
      retryable: false,
      code: "PERMISSION_ERROR",
    };
  }

  return {
    message,
    userMessage,
    retryable,
    code: extractErrorCode(message),
  };
}

/**
 * Get user-friendly error message
 */
function getUserFriendlyMessage(error: string): string {
  const lowerError = error.toLowerCase();

  // Sui/Blockchain errors
  if (lowerError.includes("insufficient gas") || lowerError.includes("insufficient funds")) {
    return "Số dư SUI không đủ để thực hiện transaction. Vui lòng nạp thêm SUI vào ví.";
  }

  if (lowerError.includes("user rejected") || lowerError.includes("user cancelled")) {
    return "Bạn đã hủy transaction. Không có thay đổi nào được thực hiện.";
  }

  if (lowerError.includes("expired") || lowerError.includes("hết hạn")) {
    return "Sản phẩm đã hết hạn và không thể chuyển giao.";
  }

  if (lowerError.includes("invalid role") || lowerError.includes("permission denied")) {
    return "Ví của bạn chưa được cấp quyền phù hợp. Vui lòng liên hệ admin để được cấp quyền.";
  }

  if (lowerError.includes("not found") || lowerError.includes("không tìm thấy")) {
    return "Không tìm thấy dữ liệu. Vui lòng kiểm tra lại thông tin.";
  }

  if (lowerError.includes("already exists") || lowerError.includes("đã tồn tại")) {
    return "Dữ liệu đã tồn tại trong hệ thống.";
  }

  // Network errors
  if (lowerError.includes("timeout") || lowerError.includes("timed out")) {
    return "Yêu cầu quá thời gian chờ. Vui lòng thử lại.";
  }

  if (lowerError.includes("failed to fetch") || lowerError.includes("network error")) {
    return "Lỗi kết nối mạng. Vui lòng kiểm tra kết nối và thử lại.";
  }

  // Default: return original message if it's already user-friendly
  if (error.length < 100 && !error.includes("Error:") && !error.includes("at ")) {
    return error;
  }

  // Technical error - return generic message
  return "Đã xảy ra lỗi. Vui lòng thử lại sau hoặc liên hệ hỗ trợ nếu lỗi vẫn tiếp tục.";
}

/**
 * Get user-friendly message for Sui errors
 */
function getSuiUserFriendlyMessage(suiError: string): string {
  const lowerError = suiError.toLowerCase();

  if (lowerError.includes("insufficient gas") || lowerError.includes("insufficient funds")) {
    return "Số dư SUI không đủ. Vui lòng nạp thêm SUI vào ví.";
  }

  if (lowerError.includes("object not found") || lowerError.includes("object does not exist")) {
    return "NFT không tồn tại hoặc đã bị xóa.";
  }

  if (lowerError.includes("expired")) {
    return "Sản phẩm đã hết hạn và không thể thực hiện thao tác này.";
  }

  if (lowerError.includes("invalid role") || lowerError.includes("permission")) {
    return "Bạn không có quyền thực hiện thao tác này. Vui lòng liên hệ admin.";
  }

  if (lowerError.includes("transfer not allowed")) {
    return "Chuyển giao không được phép. Kiểm tra quyền và trạng thái của NFT.";
  }

  return getUserFriendlyMessage(suiError);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: string): boolean {
  const lowerError = error.toLowerCase();

  // Network errors are retryable
  if (
    lowerError.includes("network") ||
    lowerError.includes("timeout") ||
    lowerError.includes("fetch failed") ||
    lowerError.includes("econnrefused")
  ) {
    return true;
  }

  // Rate limit errors are retryable
  if (lowerError.includes("rate limit") || lowerError.includes("too many requests")) {
    return true;
  }

  // Server errors (5xx) are retryable
  if (lowerError.includes("500") || lowerError.includes("502") || lowerError.includes("503")) {
    return true;
  }

  // User errors are not retryable
  if (
    lowerError.includes("user rejected") ||
    lowerError.includes("invalid") ||
    lowerError.includes("permission") ||
    lowerError.includes("not found")
  ) {
    return false;
  }

  return false;
}

/**
 * Extract error code from error message
 */
function extractErrorCode(error: string): string | undefined {
  // Try to extract error codes like "E123", "ERROR_CODE", etc.
  const codeMatch = error.match(/\b(E\d+|ERROR_\w+|ERR_\w+)\b/i);
  return codeMatch ? codeMatch[1] : undefined;
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const errorDetails = parseError(error);

      // Don't retry if error is not retryable
      if (!errorDetails.retryable) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Safe async function wrapper with error handling
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  onError?: (error: ErrorDetails) => void
): Promise<{ success: true; data: T } | { success: false; error: ErrorDetails }> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    const errorDetails = parseError(error);
    if (onError) {
      onError(errorDetails);
    }
    return { success: false, error: errorDetails };
  }
}

