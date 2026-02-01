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

  // Check for RPC error with detailed info
  if (error.data) {
    if (typeof error.data === 'string') {
      return error.data;
    }
    if (error.data.message) {
      return error.data.message;
    }
    // Sui RPC errors often have code and message in data
    if (error.data.code) {
      return `RPC Error ${error.data.code}: ${error.data.message || JSON.stringify(error.data)}`;
    }
  }

  // Check for effects error (transaction execution error)
  if (error.effects?.status?.error) {
    const effectError = error.effects.status.error;
    if (typeof effectError === 'string') {
      return effectError;
    }
    if (effectError.message) {
      return effectError.message;
    }
    if (effectError.code) {
      return `Transaction Error ${effectError.code}: ${effectError.message || JSON.stringify(effectError)}`;
    }
    return JSON.stringify(effectError);
  }

  // Check for Sui transaction error format
  if (error.cause) {
    if (typeof error.cause === 'string') {
      return error.cause;
    }
    if (error.cause.message) {
      return error.cause.message;
    }
  }

  // Check for nested error
  if (error.error) {
    return parseSuiError(error.error);
  }

  // Fallback - try to extract meaningful info
  try {
    const errorStr = JSON.stringify(error);
    // If error is too long, truncate it
    if (errorStr.length > 500) {
      return errorStr.substring(0, 500) + '...';
    }
    return errorStr;
  } catch {
    return String(error);
  }
}

/**
 * Get error hints for common Sui errors
 */
export function getSuiErrorHints(error: any): string[] {
  const hints: string[] = [];
  const errorMessage = parseSuiError(error).toLowerCase();

  if (errorMessage.includes('insufficient') || errorMessage.includes('balance') || errorMessage.includes('gas')) {
    hints.push('Không đủ SUI để thanh toán gas fee');
    hints.push('Vui lòng nạp thêm SUI vào ví OWNER_PRIVATE_KEY');
    hints.push('Kiểm tra số dư SUI của admin wallet');
  }

  if (errorMessage.includes('object not found') || errorMessage.includes('does not exist')) {
    hints.push('Object không tồn tại trên blockchain');
    hints.push('Kiểm tra lại SUI_CONTRACT_OBJECT_ID trong biến môi trường');
    hints.push('Đảm bảo contract đã được deploy');
  }

  if (errorMessage.includes('invalid owner') || errorMessage.includes('unauthorized')) {
    hints.push('Bạn không phải là chủ sở hữu của object này');
    hints.push('Kiểm tra lại quyền sở hữu');
    hints.push('Đảm bảo OWNER_PRIVATE_KEY là admin của contract');
  }

  if (errorMessage.includes('invalid role') || errorMessage.includes('permission denied')) {
    hints.push('Ví của bạn chưa được cấp quyền phù hợp');
    hints.push('OWNER_PRIVATE_KEY phải có ADMIN role trong contract');
    hints.push('Kiểm tra lại quyền admin trong contract');
  }

  if (errorMessage.includes('expired')) {
    hints.push('Sản phẩm đã hết hạn');
    hints.push('Không thể transfer sản phẩm đã hết hạn');
  }

  if (errorMessage.includes('connection') || errorMessage.includes('network') || errorMessage.includes('timeout')) {
    hints.push('Không thể kết nối đến Sui network');
    hints.push('Kiểm tra lại kết nối internet và RPC endpoint');
    hints.push('Kiểm tra SUI_RPC_URL trong biến môi trường');
  }

  if (errorMessage.includes('package') || errorMessage.includes('module not found')) {
    hints.push('Package hoặc module không tồn tại');
    hints.push('Kiểm tra lại SUI_PACKAGE_ID trong biến môi trường');
    hints.push('Đảm bảo contract đã được publish');
  }

  if (errorMessage.includes('function') || errorMessage.includes('entry')) {
    hints.push('Function không tồn tại hoặc không thể gọi');
    hints.push('Kiểm tra lại tên function trong contract');
    hints.push('Đảm bảo function là public entry function');
  }

  return hints;
}

