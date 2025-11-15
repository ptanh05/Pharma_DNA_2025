/**
 * Input Validator for AI Agent
 * Validate inputs trước khi execute để tránh errors
 */

import { z } from "zod";

export const ipfsHashSchema = z.string().min(10).max(100).regex(/^Qm[a-zA-Z0-9]+$/);

export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

export const tokenIdSchema = z.number().int().positive();

export function validateIPFSHash(hash: string): { valid: boolean; error?: string } {
  try {
    ipfsHashSchema.parse(hash);
    return { valid: true };
  } catch (error: any) {
    return { valid: false, error: "Invalid IPFS hash format" };
  }
}

export function validateAddress(address: string): { valid: boolean; error?: string } {
  try {
    addressSchema.parse(address);
    return { valid: true };
  } catch (error: any) {
    return { valid: false, error: "Invalid Ethereum address format" };
  }
}

export function validateTokenId(tokenId: number): { valid: boolean; error?: string } {
  try {
    tokenIdSchema.parse(tokenId);
    return { valid: true };
  } catch (error: any) {
    return { valid: false, error: "Invalid token ID" };
  }
}

export function validateTaskInput(task: string): { valid: boolean; error?: string } {
  if (!task || task.trim().length === 0) {
    return { valid: false, error: "Task cannot be empty" };
  }

  if (task.length > 5000) {
    return { valid: false, error: "Task too long (max 5000 characters)" };
  }

  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    /DROP\s+TABLE/i,
    /DELETE\s+FROM/i,
    /UPDATE\s+.*\s+SET/i,
    /;\s*--/,
    /\/\*.*\*\//,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(task)) {
      return { valid: false, error: "Task contains potentially dangerous patterns" };
    }
  }

  return { valid: true };
}

