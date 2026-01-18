/**
 * Sui Error Parsing
 * Parse and format Sui blockchain errors
 */

export interface SuiError {
  message: string;
  code?: string;
  details?: any;
}

/**
 * Parse Sui error
 */
export function parseSuiError(error: any): string {
  if (!error) {
    return 'Unknown error';
  }

  // If it's already a string
  if (typeof error === 'string') {
    return error;
  }

  // Check for error message
  if (error.message) {
    return error.message;
  }

  // Check for Sui-specific error format
  if (error.code) {
    return `Sui Error ${error.code}: ${error.message || 'Unknown error'}`;
  }

  // Check for RPC error
  if (error.data) {
    if (typeof error.data === 'string') {
      return error.data;
    }
    if (error.data.message) {
      return error.data.message;
    }
  }

  // Check for effects error
  if (error.effects?.status?.error) {
    return error.effects.status.error;
  }

  // Fallback
  return JSON.stringify(error);
}

/**
 * Get error hints for common Sui errors
 */
export function getSuiErrorHints(error: any): string[] {
  const hints: string[] = [];
  const errorMessage = parseSuiError(error).toLowerCase();

  if (errorMessage.includes('insufficient gas')) {
    hints.push('Không đủ SUI để thanh toán gas fee');
    hints.push('Vui lòng nạp thêm SUI vào ví');
  }

  if (errorMessage.includes('object not found')) {
    hints.push('Object không tồn tại trên blockchain');
    hints.push('Kiểm tra lại object ID');
  }

  if (errorMessage.includes('invalid owner')) {
    hints.push('Bạn không phải là chủ sở hữu của object này');
    hints.push('Kiểm tra lại quyền sở hữu');
  }

  if (errorMessage.includes('invalid role')) {
    hints.push('Ví của bạn chưa được cấp quyền phù hợp');
    hints.push('Liên hệ admin để được cấp quyền');
  }

  if (errorMessage.includes('expired')) {
    hints.push('Sản phẩm đã hết hạn');
    hints.push('Không thể transfer sản phẩm đã hết hạn');
  }

  if (errorMessage.includes('connection')) {
    hints.push('Không thể kết nối đến Sui network');
    hints.push('Kiểm tra lại kết nối internet và RPC endpoint');
  }

  return hints;
}

