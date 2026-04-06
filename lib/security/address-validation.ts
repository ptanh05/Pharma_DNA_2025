/**
 * Address Validation Utilities
 * Supports EVM (Ethereum) and Sui blockchain address formats.
 *
 * Features:
 * - Format validation (prefix + length)
 * - EVM EIP-55 checksum verification
 * - Normalization (lowercase for storage)
 */

import { createHash, createKeccak256 } from "crypto";

/**
 * Address type based on format.
 */
export type AddressType = "evm" | "sui" | "unknown";

/**
 * Validation result.
 */
export interface AddressValidationResult {
  valid: boolean;
  address: string;        // Normalized address (lowercase for storage)
  originalInput: string;
  type: AddressType;
  checksummed?: string;   // EIP-55 checksummed version (only for EVM)
  error?: string;
}

/**
 * Detect address type from format.
 */
export function detectAddressType(address: string): AddressType {
  const clean = address.trim().toLowerCase();

  // Sui: 0x + 64 hex chars
  if (/^0x[a-f0-9]{64}$/.test(clean)) return "sui";

  // EVM: 0x + 40 hex chars
  if (/^0x[a-f0-9]{40}$/.test(clean)) return "evm";

  return "unknown";
}

/**
 * Compute EIP-55 checksum for an EVM address.
 * https://eips.ethereum.org/EIPS/eip-55
 */
function computeEIP55Checksum(address: string): string {
  // Address must be lowercase hex (without 0x prefix)
  const addr = address.toLowerCase().replace(/^0x/, "");
  const hash = createHash("sha256")
    .update(Buffer.from(addr))
    .digest("hex");

  let result = "0x";
  for (let i = 0; i < addr.length; i++) {
    const char = addr[i];
    // If the corresponding hex digit of the hash is >= 8, uppercase the address character
    const hashChar = hash[i];
    if (/[0-9]/.test(char)) {
      result += char;
    } else if (parseInt(hashChar, 16) >= 8) {
      result += char.toUpperCase();
    } else {
      result += char;
    }
  }
  return result;
}

/**
 * EIP-55 checksum verification.
 * Returns the checksummed address if valid, or the original (invalid) address if checksum mismatch.
 */
export function verifyEIP55Checksum(address: string): {
  valid: boolean;
  checksummedAddress: string;
} {
  const clean = address.trim();
  const prefix = clean.startsWith("0x") ? "0x" : "";
  const addrWithoutPrefix = clean.toLowerCase().replace(/^0x/, "");

  const checksummed = computeEIP55Checksum(addrWithoutPrefix);

  // Compare checksummed version with original (case-sensitive check)
  const isValid = clean === checksummed;

  return { valid: isValid, checksummedAddress: checksummed };
}

/**
 * Validate and normalize an address.
 *
 * For EVM addresses:
 *   - Validates format (0x + 40 hex)
 *   - Verifies EIP-55 checksum (warns if missing/wrong, still accepts for UX flexibility)
 *   - Returns normalized (lowercase) address for storage
 *
 * For Sui addresses:
 *   - Validates format (0x + 64 hex)
 *   - Returns lowercase address
 */
export function validateAndNormalizeAddress(
  address: string,
  options?: {
    requireChecksum?: boolean; // If true, rejects EVM addresses with bad checksum
    allowMixedCase?: boolean; // If true, accepts mixed-case EVM without error
  }
): AddressValidationResult {
  const originalInput = address.trim();
  const clean = originalInput.toLowerCase();

  // ── Format check ────────────────────────────────────────────────────────────
  if (!/^0x[a-f0-9]{40}$/.test(clean) && !/^0x[a-f0-9]{64}$/.test(clean)) {
    // Try case-sensitive check (might be checksummed EVM)
    const withPrefix = originalInput.startsWith("0x") ? originalInput : `0x${originalInput}`;
    if (/^0x[a-fA-F0-9]{40}$/.test(withPrefix) || /^0x[a-fA-F0-9]{64}$/.test(withPrefix)) {
      // Mixed case detected — validate as EVM or Sui
      const lower = withPrefix.toLowerCase();
      if (/^0x[a-f0-9]{40}$/.test(lower)) {
        const { valid, checksummedAddress } = verifyEIP55Checksum(withPrefix);
        if (!valid && (options?.requireChecksum ?? false)) {
          return {
            valid: false,
            address: lower,
            originalInput,
            type: "evm",
            checksummed: checksummedAddress,
            error: `Địa chỉ EVM không đúng checksum. Dùng: ${checksummedAddress}`,
          };
        }
        // Non-strict mode: accept but flag it
        return {
          valid: true,
          address: lower,
          originalInput,
          type: "evm",
          checksummed: checksummedAddress,
          error: options?.allowMixedCase !== false
            ? `Cảnh báo: địa chỉ EVM không có checksum đúng. Nên dùng: ${checksummedAddress}`
            : undefined,
        };
      }
      if (/^0x[a-f0-9]{64}$/.test(lower)) {
        return { valid: true, address: lower, originalInput, type: "sui" };
      }
    }

    return {
      valid: false,
      address: clean,
      originalInput,
      type: "unknown",
      error: "Địa chỉ không hợp lệ. Phải là địa chỉ EVM (0x + 40 hex) hoặc Sui (0x + 64 hex).",
    };
  }

  // ── EVM address ──────────────────────────────────────────────────────────────
  if (/^0x[a-f0-9]{40}$/.test(clean)) {
    const { valid: checksumValid, checksummedAddress } = verifyEIP55Checksum(originalInput);
    if (!checksumValid && (options?.requireChecksum ?? false)) {
      return {
        valid: false,
        address: clean,
        originalInput,
        type: "evm",
        checksummed: checksummedAddress,
        error: `Địa chỉ EVM không đúng checksum. Dùng: ${checksummedAddress}`,
      };
    }
    return {
      valid: true,
      address: clean, // Always store lowercase
      originalInput,
      type: "evm",
      checksummed: checksummedAddress,
      error: !checksumValid
        ? `Cảnh báo: địa chỉ nên dùng EIP-55 checksum: ${checksummedAddress}`
        : undefined,
    };
  }

  // ── Sui address ──────────────────────────────────────────────────────────────
  if (/^0x[a-f0-9]{64}$/.test(clean)) {
    return { valid: true, address: clean, originalInput, type: "sui" };
  }

  return {
    valid: false,
    address: clean,
    originalInput,
    type: "unknown",
    error: "Địa chỉ không hợp lệ.",
  };
}

/**
 * Validate an address and throw if invalid.
 * Convenience wrapper for use in API routes.
 */
export function requireValidAddress(
  address: string,
  options?: { requireChecksum?: boolean; allowMixedCase?: boolean }
): string {
  const result = validateAndNormalizeAddress(address, options);
  if (!result.valid) {
    const err = new Error(result.error || "Invalid address");
    (err as any).addressValidation = result;
    throw err;
  }
  if (result.error && options?.requireChecksum) {
    const err = new Error(result.error);
    (err as any).addressValidation = result;
    throw err;
  }
  return result.address;
}

/**
 * Format an address for display (truncate middle).
 */
export function formatAddressDisplay(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * EVM-only EIP-55 checksum (exports for use in UI).
 */
export { computeEIP55Checksum, verifyEIP55Checksum };
