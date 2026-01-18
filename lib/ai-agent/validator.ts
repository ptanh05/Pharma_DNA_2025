/**
 * Input Validator for AI Agent
 * Validate và sanitize inputs trước khi xử lý
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate Sui address format
 */
export function validateAddress(address: string): ValidationResult {
  if (!address || typeof address !== "string") {
    return { valid: false, error: "Address is required" };
  }

  // Sui addresses are hex strings starting with '0x' and 64 characters total
  const suiAddressPattern = /^0x[a-fA-F0-9]{64}$/;
  
  if (!suiAddressPattern.test(address)) {
    return { valid: false, error: "Invalid Sui address format (must be 0x followed by 64 hex characters)" };
  }

  return { valid: true };
}

/**
 * Validate token ID
 */
export function validateTokenId(tokenId: number): ValidationResult {
  if (typeof tokenId !== "number" || isNaN(tokenId)) {
    return { valid: false, error: "Token ID must be a number" };
  }

  if (tokenId < 0) {
    return { valid: false, error: "Token ID must be non-negative" };
  }

  if (tokenId > Number.MAX_SAFE_INTEGER) {
    return { valid: false, error: "Token ID too large" };
  }

  return { valid: true };
}

/**
 * Validate IPFS hash
 */
export function validateIPFSHash(hash: string): ValidationResult {
  if (!hash || typeof hash !== "string") {
    return { valid: false, error: "IPFS hash is required" };
  }

  // IPFS hashes can be CIDv0 (Qm...) or CIDv1
  const ipfsPattern = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{56,})$/;
  
  if (!ipfsPattern.test(hash)) {
    return { valid: false, error: "Invalid IPFS hash format" };
  }

  return { valid: true };
}

/**
 * Validate batch number
 */
export function validateBatchNumber(batchNumber: string): ValidationResult {
  if (!batchNumber || typeof batchNumber !== "string") {
    return { valid: false, error: "Batch number is required" };
  }

  if (batchNumber.length > 100) {
    return { valid: false, error: "Batch number too long (max 100 characters)" };
  }

  // Allow alphanumeric, dashes, underscores
  const batchPattern = /^[A-Za-z0-9_-]+$/;
  if (!batchPattern.test(batchNumber)) {
    return { valid: false, error: "Batch number contains invalid characters" };
  }

  return { valid: true };
}

/**
 * Validate expiry date (Unix timestamp)
 */
export function validateExpiryDate(expiryDate: number): ValidationResult {
  if (typeof expiryDate !== "number" || isNaN(expiryDate)) {
    return { valid: false, error: "Expiry date must be a number" };
  }

  const now = Math.floor(Date.now() / 1000);
  const maxFuture = now + (10 * 365 * 24 * 60 * 60); // 10 years from now

  if (expiryDate < now) {
    return { valid: false, error: "Expiry date cannot be in the past" };
  }

  if (expiryDate > maxFuture) {
    return { valid: false, error: "Expiry date too far in the future" };
  }

  return { valid: true };
}

/**
 * Validate role
 */
export function validateRole(role: number): ValidationResult {
  if (typeof role !== "number" || isNaN(role)) {
    return { valid: false, error: "Role must be a number" };
  }

  // Roles: 0=None, 1=Manufacturer, 2=Distributor, 3=Pharmacy, 4=Admin
  if (role < 0 || role > 4) {
    return { valid: false, error: "Invalid role (must be 0-4)" };
  }

  return { valid: true };
}

/**
 * Validate string length
 */
export function validateStringLength(
  str: string,
  minLength: number = 1,
  maxLength: number = 1000
): ValidationResult {
  if (typeof str !== "string") {
    return { valid: false, error: "Input must be a string" };
  }

  if (str.length < minLength) {
    return { valid: false, error: `String too short (min ${minLength} characters)` };
  }

  if (str.length > maxLength) {
    return { valid: false, error: `String too long (max ${maxLength} characters)` };
  }

  return { valid: true };
}

/**
 * Validate email (for notifications)
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || typeof email !== "string") {
    return { valid: false, error: "Email is required" };
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return { valid: false, error: "Invalid email format" };
  }

  return { valid: true };
}

/**
 * Validate array of items
 */
export function validateArray<T>(
  arr: T[],
  minLength: number = 0,
  maxLength: number = 1000,
  itemValidator?: (item: T) => ValidationResult
): ValidationResult {
  if (!Array.isArray(arr)) {
    return { valid: false, error: "Input must be an array" };
  }

  if (arr.length < minLength) {
    return { valid: false, error: `Array too short (min ${minLength} items)` };
  }

  if (arr.length > maxLength) {
    return { valid: false, error: `Array too long (max ${maxLength} items)` };
  }

  if (itemValidator) {
    for (let i = 0; i < arr.length; i++) {
      const validation = itemValidator(arr[i]);
      if (!validation.valid) {
        return { valid: false, error: `Item at index ${i}: ${validation.error}` };
      }
    }
  }

  return { valid: true };
}
