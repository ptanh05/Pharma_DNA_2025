/**
 * Database Connection Pool
 * Optimized connection pooling for PostgreSQL
 */

import { Pool, PoolConfig } from 'pg';

let poolInstance: Pool | null = null;

/**
 * Get or create database connection pool
 * Uses connection pooling for better performance
 */
export function getPool(): Pool {
  if (!poolInstance) {
    const config: PoolConfig = {
      connectionString: process.env.DATABASE_URL,
      // Connection pool settings
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection cannot be established
      // Statement timeout
      statement_timeout: 30000, // 30 seconds
      // Query timeout
      query_timeout: 30000, // 30 seconds
    };

    poolInstance = new Pool(config);

    // Handle pool errors
    poolInstance.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  return poolInstance;
}

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
      console.warn(`Slow query (${duration}ms):`, text.substring(0, 100));
    }
    
    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
    };
  } catch (error) {
    console.error('Database query error:', error);
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

