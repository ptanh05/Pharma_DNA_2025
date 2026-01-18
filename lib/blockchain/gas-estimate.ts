/**
 * Gas Fee Estimation Utilities
 * Estimate gas fees for Sui transactions
 */

import { getSuiClient } from "./provider-sui";

/**
 * Estimate gas fee for a transaction
 * Note: Sui uses a different gas model - fees are very low and predictable
 * This is a simplified estimation
 */
export async function estimateGasFee(
  transactionBlock: Uint8Array | any
): Promise<{ estimatedGas: string; estimatedFee: string }> {
  try {
    // For Sui, gas fees are typically very low (0.001-0.01 SUI)
    // We'll use a conservative estimate
    // In production, you could use the dryRunTransaction RPC call for more accurate estimates
    
    const client = getSuiClient();
    
    // Simplified: Sui transactions typically cost 0.001-0.01 SUI
    // More complex transactions (with multiple operations) may cost more
    const baseGas = 0.001; // Base fee in SUI
    const estimatedGas = baseGas.toFixed(4);
    const estimatedFee = `${estimatedGas} SUI`;

    return {
      estimatedGas: estimatedGas,
      estimatedFee: estimatedFee,
    };
  } catch (error) {
    console.error("Error estimating gas fee:", error);
    // Return conservative estimate on error
    return {
      estimatedGas: "0.01",
      estimatedFee: "0.01 SUI",
    };
  }
}

/**
 * Format gas fee for display
 */
export function formatGasFee(gasFee: string | number): string {
  const fee = typeof gasFee === "string" ? parseFloat(gasFee) : gasFee;
  if (fee < 0.001) {
    return "< 0.001 SUI";
  }
  return `${fee.toFixed(4)} SUI`;
}

