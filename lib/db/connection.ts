/**
 * Database Connection Pool
 * Optimized connection pooling for PostgreSQL
 */

import { Pool, PoolConfig } from 'pg';
import { logger } from '@/lib/utils/logger';

let poolInstance: Pool | null = null;

/**
 * Get or create database connection pool
 * Uses connection pooling for better performance
 */
export function getPool(): Pool {
  if (!poolInstance) {
    const config: PoolConfig = {
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

    poolInstance = new Pool(config);

    // Handle pool errors
    poolInstance.on('error', (err) => {
      logger.error('DB_CONNECTION', 'Unexpected error on idle client', err);
    });
  }

  return poolInstance;
}

// Backward compatibility - export pool directly
// NOTE: pool is now a getter that initializes on first use, not at module import
// This prevents build-time errors when DATABASE_URL is not set
export const pool = {
  query: async (text: string, params?: any[]) => {
    return getPool().query(text, params);
  }
};

/**
 * Execute query with error handling
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = getPool();
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries (over 1 second)
    if (duration > 1000) {
      logger.warn('DB_CONNECTION', 'Slow query detected', { durationMs: duration, query: text.substring(0, 100) });
    }
    
    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
    };
  } catch (error) {
    logger.error('DB_CONNECTION', 'Database query error', error);
    throw error;
  }
}

/**
 * Close pool (useful for testing)
 */
export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}

