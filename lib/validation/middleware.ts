/**
 * Validation Middleware for API Routes
 * Helper functions to validate and sanitize request data
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeString, sanitizeAddress } from "./schemas";

// Re-export for convenience
export { sanitizeString, sanitizeAddress };

/**
 * Validate request body with Zod schema
 */
export function validateRequest<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string; details?: any } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: firstError.message || "Dữ liệu không hợp lệ",
        details: error.errors,
      };
    }
    return {
      success: false,
      error: "Lỗi validation không xác định",
    };
  }
}

/**
 * Validate and sanitize request body
 */
export function validateAndSanitizeRequest<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string; details?: any } {
  // First validate
  const validation = validateRequest(schema, data);
  if (!validation.success) {
    return validation;
  }

  // Then sanitize string fields
  const sanitized = { ...validation.data };
  for (const key in sanitized) {
    if (typeof sanitized[key] === "string") {
      // Don't sanitize addresses (they have specific format)
      if (key.includes("address") || key.includes("Address")) {
        sanitized[key] = sanitizeAddress(sanitized[key]);
      } else {
        sanitized[key] = sanitizeString(sanitized[key]);
      }
    }
  }

  return { success: true, data: sanitized };
}

/**
 * Create error response for validation failures
 */
export function validationErrorResponse(
  error: string,
  details?: any,
  status: number = 400
): NextResponse {
  return NextResponse.json(
    {
      error,
      details: details || undefined,
    },
    { status }
  );
}

/**
 * Validate file upload
 */
export function validateFileUpload(
  file: File | null,
  maxSize: number = 10 * 1024 * 1024, // 10MB default
  allowedTypes: string[] = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/json",
  ]
): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: true }; // Optional file
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File quá lớn. Kích thước tối đa: ${Math.round(maxSize / 1024 / 1024)}MB`,
    };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Loại file không được phép. Chỉ chấp nhận: ${allowedTypes.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Validate date range (expiry > manufacturing)
 */
export function validateDateRange(
  manufacturingDate: string | Date,
  expiryDate: string | Date
): { valid: boolean; error?: string } {
  const manufacturing = typeof manufacturingDate === "string" 
    ? new Date(manufacturingDate) 
    : manufacturingDate;
  const expiry = typeof expiryDate === "string" 
    ? new Date(expiryDate) 
    : expiryDate;

  if (isNaN(manufacturing.getTime())) {
    return { valid: false, error: "Ngày sản xuất không hợp lệ" };
  }

  if (isNaN(expiry.getTime())) {
    return { valid: false, error: "Hạn dùng không hợp lệ" };
  }

  if (expiry <= manufacturing) {
    return { valid: false, error: "Hạn dùng phải sau ngày sản xuất" };
  }

  return { valid: true };
}
