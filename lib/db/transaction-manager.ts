/**
 * Transaction Manager với Idempotency
 * Đảm bảo consistency giữa Blockchain và Database
 * 
 * Sử dụng cho:
 * - Mint NFT
 * - Transfer NFT
 * - Confirm receipt
 * - Dispense product
 */

import { pool }from './connection';

export interface TransactionResult {
  success: boolean;
  data?: any;
  error?: string;
  digest?: string;
  timestamp: number;
}

/**
 * TransactionManager - Quản lý giao dịch với recovery
 */
export class TransactionManager {
  /**
   * Thực thi operation với recovery nếu thất bại
   * 
   * @param operation - Hàm thực thi (blockchain + db)
   * @param idempotencyKey - Khóa duy nhất để tránh duplicate
   * @returns Kết quả của operation
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    idempotencyKey: string
  ): Promise<T> {
    try {
      // Bước 1: Kiểm tra nếu đã thực thi trước đó
      const existing = await this.getExistingResult(idempotencyKey);
      if (existing) {
        console.log(`[TransactionManager] Idempotency hit for key: ${idempotencyKey}`);
        return existing.result as T;
      }

      // Bước 2: Thực thi operation
      console.log(`[TransactionManager] Executing operation with key: ${idempotencyKey}`);
      const result = await operation();

      // Bước 3: Lưu vào DB để recovery
      await this.saveResult(idempotencyKey, result, 'success');

      console.log(`[TransactionManager] Operation succeeded for key: ${idempotencyKey}`);
      return result;
    }catch (error: any) {
      // Bước 4: Kiểm tra nếu operation một phần thành công
      console.error(`[TransactionManager] Operation failed for key: ${idempotencyKey}`, error);

      const partial = await this.checkPartialState(idempotencyKey);
      if (partial) {
        console.log(`[TransactionManager] Partial state detected, attempting recovery`);
        // Lưu lại partial state để manual recovery
        await this.saveResult(idempotencyKey, partial, 'partial');
      }

      // Bước 5: Lưu lỗi vào recovery log
      await this.logFailure(idempotencyKey, error);
      throw error;
    }
  }

  /**
   * Kiểm tra nếu operation đã được thực thi trước đó
   */
  private async getExistingResult(idempotencyKey: string): Promise<{ result: any; status: string } | null> {
    try {
      const query = `
        SELECT result, status 
        FROM tx_recovery_log 
        WHERE idempotency_key = $1 
        AND created_at > NOW() - INTERVAL '24 hours'
        LIMIT 1
      `;
      const result = await pool.query(query, [idempotencyKey]);

      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          result: row.result,
          status: row.status,
        };
      }

      return null;
    } catch (error) {
      console.error('[TransactionManager] Error checking existing result:', error);
      return null;
    }
  }

  /**
   * Lưu kết quả transaction vào DB
   */
  private async saveResult(
    idempotencyKey: string,
    result: any,
    status: 'success' | 'partial' | 'failed'
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO tx_recovery_log (
          idempotency_key, 
          result, 
          status, 
          created_at
        ) VALUES ($1, $2, $3, NOW())
        ON CONFLICT (idempotency_key) 
        DO UPDATE SET 
          result = $2,
          status = $3,
          updated_at = NOW()
      `;

      await pool.query(query, [
        idempotencyKey,
        JSON.stringify(result),
        status,
      ]);

      console.log(`[TransactionManager] Saved result for key: ${idempotencyKey}`);
    }catch (error) {
      console.error('[TransactionManager] Error saving result:', error);
      // Không throw, cho phép operation tiếp tục
    }
  }

  /**
   * Kiểm tra nếu operation một phần thành công
   * (e.g., blockchain thành công nhưng DB insert thất bại)
   */
  private async checkPartialState(idempotencyKey: string): Promise<any | null> {
    try {
      // Kiểm tra trong các specific tables
      // Ví dụ: Nếu NFT được mint nhưng không được lưu vào DB
      
      // Có thể extend này dựa trên loại operation
      // Tạm thời return null
      return null;
    }catch (error) {
      console.error('[TransactionManager] Error checking partial state:', error);
      return null;
    }
  }

  /**
   * Lưu lỗi vào log để manual recovery
   */
  private async logFailure(idempotencyKey: string, error: any): Promise<void> {
    try {
      const query = `
        INSERT INTO tx_recovery_log (
          idempotency_key,
          status,
          error_message,
          error_stack,
          created_at
        ) VALUES ($1, 'error', $2, $3, NOW())
        ON CONFLICT (idempotency_key)
        DO UPDATE SET
          status = 'error',
          error_message = $2,
          error_stack = $3,
          updated_at = NOW()
      `;

      await pool.query(query, [
        idempotencyKey,
        error.message || 'Unknown error',
        error.stack || '',
      ]);

      console.log(`[TransactionManager] Logged failure for key: ${idempotencyKey}`);
    } catch (logError) {
      console.error('[TransactionManager] Error logging failure:', logError);
    }
  }

  /**
   * Retry operation với exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    idempotencyKey: string,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[TransactionManager] Attempt ${attempt + 1}/${maxRetries + 1}for key: ${idempotencyKey}`);

        if (attempt > 0) {
          // Exponential backoff
          const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
          console.log(`[TransactionManager] Waiting ${delayMs}ms before retry`);
          await this.sleep(delayMs);
        }

        return await this.executeWithRecovery(operation, idempotencyKey);
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries) {
          console.warn(`[TransactionManager] Attempt ${attempt + 1} failed, retrying...`);
        } else {
          console.error(`[TransactionManager] All ${maxRetries + 1} attempts failed for key: ${idempotencyKey}`);
        }
      }
    }

    throw lastError;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Đặt lại idempotency key (chỉ dùng khi chắc chắn operation thất bại hoàn toàn)
   */
  async resetIdempotency(idempotencyKey: string): Promise<void> {
    try {
      const query = `
        DELETE FROM tx_recovery_log 
        WHERE idempotency_key = $1
      `;
      await pool.query(query, [idempotencyKey]);
      console.log(`[TransactionManager] Reset idempotency for key: ${idempotencyKey}`);
    } catch (error) {
      console.error('[TransactionManager] Error resetting idempotency:', error);
    }
  }
}

/**
 * Singleton instance
 */
let instance: TransactionManager | null = null;

export function getTransactionManager(): TransactionManager {
  if (!instance) {
    instance = new TransactionManager();
  }
  return instance;
}
