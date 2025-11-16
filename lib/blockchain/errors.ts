/**
 * Neo N3 Error Handling
 * Parse and format Neo-specific error messages
 */

/**
 * Neo Error Interface
 */
export interface NeoError {
  message: string;
  code?: string;
}

/**
 * Parse Neo error message
 */
export function parseNeoError(error: any): NeoError {
  if (!error) {
    return { message: 'Unknown error', code: 'UNKNOWN' };
  }

  // If it's already a string
  if (typeof error === 'string') {
    return { message: error, code: 'UNKNOWN' };
  }

  // If it has a message property
  if (error.message) {
    const message = error.message;

    // Common Neo error patterns
    if (message.includes('Insufficient GAS')) {
      return { 
        message: 'Insufficient GAS balance. Please add GAS to your account.',
        code: 'INSUFFICIENT_GAS'
      };
    }

    if (message.includes('Contract not found') || message.includes('Contract does not exist')) {
      return { 
        message: 'Contract not found. Please deploy the contract first.',
        code: 'CONTRACT_NOT_FOUND'
      };
    }

    if (message.includes('Invalid address') || message.includes('Invalid UInt160')) {
      return { 
        message: 'Invalid address format. Please check the address.',
        code: 'INVALID_ADDRESS'
      };
    }

    if (message.includes('Not token owner')) {
      return { 
        message: 'You are not the owner of this token.',
        code: 'NOT_TOKEN_OWNER'
      };
    }

    if (message.includes('Token does not exist')) {
      return { 
        message: 'Token does not exist.',
        code: 'TOKEN_NOT_FOUND'
      };
    }

    if (message.includes('Only owner') || message.includes('Only manufacturer') || message.includes('Only admin')) {
      return { 
        message: 'Permission denied. You do not have the required role.',
        code: 'PERMISSION_DENIED'
      };
    }

    if (message.includes('Contract paused')) {
      return { 
        message: 'Contract is currently paused.',
        code: 'CONTRACT_PAUSED'
      };
    }

    if (message.includes('Product expired')) {
      return { 
        message: 'This product has expired and cannot be transferred.',
        code: 'PRODUCT_EXPIRED'
      };
    }

    if (message.includes('Transfer not allowed')) {
      return { 
        message: 'Transfer is not allowed between these roles.',
        code: 'TRANSFER_NOT_ALLOWED'
      };
    }

    if (message.includes('Zero address')) {
      return { 
        message: 'Invalid address: zero address is not allowed.',
        code: 'ZERO_ADDRESS'
      };
    }

    if (message.includes('Array length mismatch')) {
      return { 
        message: 'Array length mismatch. Please check your input arrays.',
        code: 'ARRAY_LENGTH_MISMATCH'
      };
    }

    // Return the original message if no pattern matches
    return { message, code: error.code || 'UNKNOWN' };
  }

  // If it's an error object with other properties
  if (error.error) {
    return parseNeoError(error.error);
  }

  // Fallback
  return { message: 'An unknown error occurred', code: 'UNKNOWN' };
}

/**
 * Get error hints for common issues
 */
export function getErrorHints(error: any): string[] {
  const hints: string[] = [];
  const neoError = parseNeoError(error);
  const errorMessage = neoError.message.toLowerCase();

  if (errorMessage.includes('gas')) {
    hints.push('💡 Get testnet GAS from: https://neowish.ngd.network/');
    hints.push('💡 Make sure your account has sufficient GAS balance');
  }

  if (errorMessage.includes('contract not found')) {
    hints.push('💡 Make sure NEO_CONTRACT_HASH is set in .env');
    hints.push('💡 Deploy the contract first using: npm run deploy');
  }

  if (errorMessage.includes('permission denied') || errorMessage.includes('role')) {
    hints.push('💡 Make sure your account has the required role assigned');
    hints.push('💡 Contact the contract owner to assign your role');
  }

  if (errorMessage.includes('invalid address')) {
    hints.push('💡 Neo N3 addresses should be 34 characters starting with N');
    hints.push('💡 Make sure the address is in the correct format');
  }

  return hints;
}

/**
 * Parse ethers error (legacy, kept for backward compatibility)
 * Now redirects to parseNeoError
 */
export function parseEthersError(error: any): NeoError {
  return parseNeoError(error);
}
