/**
 * Input Validation & Sanitization
 * Centralized validation for API requests
 */

import { z } from "zod";

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  if (typeof input !== "string") return "";
  
  return input
    .trim()
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/['"]/g, "") // Remove quotes
    .slice(0, 1000); // Limit length
}

/**
 * Sanitize address (Sui address format)
 */
export function sanitizeAddress(address: string): string {
  if (typeof address !== "string") return "";
  
  const cleaned = address.toLowerCase().trim();
  
  // Sui addresses start with 0x and are 64 hex characters
  if (!/^0x[a-f0-9]{64}$/.test(cleaned)) {
    throw new Error("Invalid Sui address format");
  }
  
  return cleaned;
}

/**
 * Validate Sui address
 */
export const suiAddressSchema = z
  .string()
  .min(1, "Address is required")
  .refine(
    (addr) => /^0x[a-f0-9]{64}$/.test(addr.toLowerCase()),
    "Invalid Sui address format"
  )
  .transform((addr) => addr.toLowerCase());

/**
 * Validate role
 */
export const roleSchema = z.enum([
  "MANUFACTURER",
  "DISTRIBUTOR",
  "PHARMACY",
  "ADMIN",
]);

/**
 * Validate NFT status
 */
export const nftStatusSchema = z.enum([
  "created",
  "minted",
  "in_transit",
  "in_pharmacy",
  "delivered",
]);

/**
 * Assign role schema
 */
export const assignRoleSchema = z.object({
  address: suiAddressSchema,
  role: roleSchema,
});

/**
 * Create NFT schema
 */
export const createNFTSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name too long")
    .transform(sanitizeString),
  batch_number: z
    .string()
    .min(1, "Batch number is required")
    .max(100, "Batch number too long")
    .transform(sanitizeString),
  manufacturer_address: suiAddressSchema,
  status: nftStatusSchema.optional().default("created"),
});

/**
 * Transfer NFT schema
 */
export const transferNFTSchema = z.object({
  nft_id: z.number().int().positive("Invalid NFT ID"),
  to_address: suiAddressSchema,
  distributor_address: suiAddressSchema,
});

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
  search: z.string().optional().transform((s) => s ? sanitizeString(s) : ""),
  sortBy: z.string().optional().default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

/**
 * Validate and sanitize request
 */
export function validateAndSanitizeRequest<T>(
  data: any,
  schema: z.ZodSchema<T>
): T {
  try {
    return schema.parse(data);
  }catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
      throw new Error(`Validation failed: ${messages.join(", ")}`);
    }
    throw error;
  }
}

/**
 * Validate pagination params
 */
export function validatePagination(params: any) {
  return paginationSchema.parse({
    page: parseInt(params.page) || 1,
    limit: parseInt(params.limit) || 10,
    search: params.search || "",
    sortBy: params.sortBy || "created_at",
    sortOrder: params.sortOrder || "desc",
  });
}

// Additional validation helpers for compatibility
export const validateRequest = validateAndSanitizeRequest;

export function validateFileUpload(file: any): boolean {
  if (!file) return false;
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
  return allowedTypes.includes(file.type);
}

export function validateDateRange(start: string, end: string): boolean {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return startDate <= endDate;
}

export function validationErrorResponse(errors: any) {
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: errors,
    },
    statusCode: 400,
  };
}
