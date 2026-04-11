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
  const errorMessage = parseSuiError(error);

  // --- MoveAbort codes from pharma_nft.move ---
  const abortCodeMatch = errorMessage.match(/MoveAbort\(?.*?code\s*[=:]\s*(\d+)/i);
  if (abortCodeMatch) {
    const code = parseInt(abortCodeMatch[1], 10);
    switch (code) {
      case 0:
        hints.push('ERR_INVALID_ROLE: Giá trị role không hợp lệ (role phải là 0-4)');
        break;
      case 1:
        hints.push('ERR_NOT_AUTHORIZED: Người gửi không có quyền thực hiện thao tác này');
        hints.push('Kiểm tra OWNER_PRIVATE_KEY có đúng là MANUFACTURER hoặc ADMIN không');
        break;
      case 2:
        hints.push('ERR_NOT_MANUFACTURER: Người gửi phải có role MANUFACTURER');
        hints.push('Gán role MANUFACTURER cho ví gửi trước khi transfer');
        break;
      case 3:
        hints.push('ERR_PRODUCT_EXPIRED: Sản phẩm đã hết hạn — không thể transfer');
        hints.push('Kiểm tra expiry_date của NFT trong blockchain');
        break;
      case 4:
        hints.push('ERR_TRANSFER_NOT_ALLOWED: Transfer bị cấm bởi contract restrictions');
        hints.push('Kiểm tra transfer_restrictions trong contract');
        break;
      case 5:
        hints.push('ERR_INVALID_TRANSFER_ROUTE: Lộ trình transfer không hợp lệ');
        hints.push('Người gửi và người nhận phải có role phù hợp:');
        hints.push('  - MANUFACTURER → DISTRIBUTOR (mặc định được phép)');
        hints.push('  - DISTRIBUTOR → PHARMACY (mặc định được phép)');
        hints.push('  - ADMIN có thể transfer đến mọi role');
        hints.push('Hãy đảm bảo: (1) ví gửi có role MANUFACTURER, (2) ví nhận có role DISTRIBUTOR hoặc PHARMACY');
        break;
      case 7:
        hints.push('ERR_USER_NOT_FOUND: Người dùng chưa được gán role trong contract');
        hints.push('Gán role cho ví gửi và/hoặc ví nhận trước khi transfer');
        break;
      case 8:
        hints.push('ERR_CANNOT_REMOVE_SELF: Không thể tự xóa role ADMIN của chính mình');
        break;
      case 9:
        hints.push('ERR_INVALID_EXPIRY_DATE: Ngày hết hạn không hợp lệ (phải > thời gian hiện tại)');
        break;
      case 10:
        hints.push('ERR_EXPIRY_TOO_FAR: Ngày hết hạn quá xa trong tương lai (> 10 năm)');
        break;
      case 11:
        hints.push('ERR_INVALID_STATUS: Trạng thái NFT không hợp lệ cho thao tác này');
        break;
      case 12:
        hints.push('ERR_NOT_OWNER: Người gửi không sở hữu NFT này');
        hints.push('Kiểm tra object_id của NFT và địa chỉ ví gửi');
        break;
      default:
        hints.push(`MoveAbort code=${code}: Lỗi từ smart contract — xem chi tiết lỗi phía trên`);
    }
    return hints;
  }

  // --- MoveAbort wrapped in "could not determine budget" ---
  if (errorMessage.includes('could not automatically determine a budget') ||
      errorMessage.includes('MoveAbort')) {
    hints.push('Transaction bị revert bởi smart contract (MoveAbort)');
    hints.push('Xem chi tiết MoveAbort phía trên để biết mã lỗi cụ thể');
    hints.push('Nếu lỗi bị che bởi "could not determine budget", hãy kiểm tra gas budget');
    return hints;
  }

  const lowerMsg = errorMessage.toLowerCase();

  if (lowerMsg.includes('insufficient') || lowerMsg.includes('balance') || lowerMsg.includes('gas')) {
    hints.push('Không đủ SUI để thanh toán gas fee');
    hints.push('Vui lòng nạp thêm SUI vào ví OWNER_PRIVATE_KEY');
    hints.push('Kiểm tra số dư SUI của admin wallet');
  }

  if (lowerMsg.includes('object not found') || lowerMsg.includes('does not exist') || lowerMsg.includes('not found')) {
    hints.push('Object không tồn tại trên blockchain');
    hints.push('Kiểm tra lại SUI_CONTRACT_OBJECT_ID trong biến môi trường');
    hints.push('Đảm bảo contract đã được deploy và object_id đúng');
  }

  if (lowerMsg.includes('invalid owner') || lowerMsg.includes('unauthorized')) {
    hints.push('Bạn không phải là chủ sở hữu của object này');
    hints.push('Kiểm tra lại quyền sở hữu');
    hints.push('Đảm bảo OWNER_PRIVATE_KEY là admin của contract');
  }

  if (lowerMsg.includes('invalid role') || lowerMsg.includes('permission denied')) {
    hints.push('Ví của bạn chưa được cấp quyền phù hợp');
    hints.push('OWNER_PRIVATE_KEY phải có ADMIN role trong contract');
    hints.push('Kiểm tra lại quyền admin trong contract');
  }

  if (lowerMsg.includes('expired')) {
    hints.push('Sản phẩm đã hết hạn');
    hints.push('Không thể transfer sản phẩm đã hết hạn');
  }

  if (lowerMsg.includes('connection') || lowerMsg.includes('network') || lowerMsg.includes('timeout')) {
    hints.push('Không thể kết nối đến Sui network');
    hints.push('Kiểm tra lại kết nối internet và RPC endpoint');
    hints.push('Kiểm tra SUI_RPC_URL trong biến môi trường');
  }

  if (lowerMsg.includes('502') || lowerMsg.includes('503') || lowerMsg.includes('bad gateway') || lowerMsg.includes('service unavailable')) {
    hints.push('Sui RPC server đang bận hoặc tạm thời ngưng hoạt động');
    hints.push('Vui lòng thử lại sau vài giây');
    hints.push('Có thể thử đổi RPC endpoint khác (testnet/devnet)');
  }

  return hints;
}

/**
 * Check if error is a network/RPC error that can be retried
 */
export function isRetryableError(error: any): boolean {
  const msg = parseSuiError(error).toLowerCase();
  if (msg.includes('502') || msg.includes('503') || msg.includes('504') ||
      msg.includes('timeout') || msg.includes('econnreset') || msg.includes('enotfound') ||
      msg.includes('bad gateway') || msg.includes('service unavailable') ||
      msg.includes('gateway timeout') || msg.includes('network') || msg.includes('connection')) {
    return true;
  }
  return false;
}
