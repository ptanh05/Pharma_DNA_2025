/**
 * Security Hardening - Input Validation & Sanitization
 */

import { z } from 'zod';

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // Sui address
  address: z
    .string()
    .regex(/^(0x)?[a-fA-F0-9]{40}$|^(0x)?[a-fA-F0-9]{64}$/, 'Invalid address format')
    .transform(val => val.toLowerCase()),

  // Email
  email: z
    .string()
    .email('Invalid email format')
    .transform(val => val.toLowerCase()),

  // UUID
  uuid: z
    .string()
    .uuid('Invalid UUID format'),

  // Positive number
  positiveNumber: z
    .number()
    .positive('Must be positive'),

  // Non-negative number
  nonNegativeNumber: z
    .number()
    .nonnegative('Must be non-negative'),

  // Batch number
  batchNumber: z
    .string()
    .min(3, 'Batch number too short')
    .max(50, 'Batch number too long')
    .regex(/^[A-Z0-9\-_]+$/, 'Invalid batch number format'),

  // IPFS hash
  ipfsHash: z
    .string()
    .regex(/^Qm[a-zA-Z0-9]{44}$/, 'Invalid IPFS hash format'),

  // Role
  role: z.enum(['MANUFACTURER', 'DISTRIBUTOR', 'PHARMACY', 'CONSUMER', 'ADMIN']),

  // JWT token
  token: z
    .string()
    .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/, 'Invalid JWT format'),

  // Pagination
  pagination: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
  }),

  // Status
  nftStatus: z.enum(['minted', 'at_distributor', 'at_pharmacy', 'dispensed']),
};

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  if (!input) return '';

  return input
    .trim()
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Validate and sanitize address
 */
export function validateAddress(address: string): string {
  try {
    return commonSchemas.address.parse(address);
  }catch (error) {
    throw new Error('Invalid address format');
  }
}

/**
 * Validate email
 */
export function validateEmail(email: string): string {
  try {
    return commonSchemas.email.parse(email);
  }catch (error) {
    throw new Error('Invalid email format');
  }
}

/**
 * Validate batch number
 */
export function validateBatchNumber(batch: string): string {
  try {
    return commonSchemas.batchNumber.parse(batch);
  }catch (error) {
    throw new Error('Invalid batch number format');
  }
}

/**
 * Check SQL injection pattern
 */
export function hasSQLInjectionPattern(input: string): boolean {
  const sqlPatterns = [
    /('|"|;|--|\/\*|\*\/|xp_|sp_|exec|execute|select|insert|update|delete|drop|create|alter|union|from|where)/i,
  ];

  return sqlPatterns.some(pattern => pattern.test(input));
}

/**
 * Check XSS pattern
 */
export function hasXSSPattern(input: string): boolean {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>/gi,
    /<embed[^>]*>/gi,
    /javascript:/gi,
    /vbscript:/gi,
  ];

  return xssPatterns.some(pattern => pattern.test(input));
}

/**
 * Secure request validator
 */
export async function validateSecureRequest<T>(
  data: any,
  schema: z.ZodSchema
): Promise<T> {
  // Check for SQL injection
  if (typeof data === 'string' && hasSQLInjectionPattern(data)) {
    throw new Error('Invalid input detected');
  }

  // Check for XSS
  if (typeof data === 'string' && hasXSSPattern(data)) {
    throw new Error('Invalid input detected');
  }

  // Validate schema
  try {
    return schema.parse(data);
  }catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation failed: ${error.errors[0].message}`);
    }
    throw error;
  }
}

/**
 * Rate limit by user action
 */
export const actionLimits = {
  MINT: { limit: 10, window: 3600 }, // 10 per hour
  TRANSFER: { limit: 50, window: 3600 }, // 50 per hour
  DISPENSE: { limit: 100, window: 3600 }, // 100 per hour
  UPGRADE_CONTRACT: { limit: 1, window: 86400 }, // 1 per day
};

/**
 * Validate action rate limit
 */
export function getActionLimit(action: keyof typeof actionLimits) {
  return actionLimits[action];
}

/**
 * Check GDPR compliance
 */
export function checkGDPRCompliance(userData: any) {
  // Ensure sensitive data is not logged
  const sensitiveFields = ['password', 'privateKey', 'secret', 'token'];

  for (const field of sensitiveFields) {
    if (field in userData) {
      throw new Error(`Sensitive field ${field} cannot be logged`);
    }
  }

  return true;
}
