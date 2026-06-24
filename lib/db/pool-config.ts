/**
 * Database Connection Pool
 * Optimized connection pooling for PostgreSQL (Neon.tech)
 */

import { Pool, PoolConfig } from 'pg';
import { logger } from '@/lib/utils/logger';

let poolInstance: Pool | null = null;

/**
 * Get or create database connection pool
 */
export function getPool(): Pool {
  if (!poolInstance) {
    const connectionUrl = (process.env.DATABASE_URL || "")
      .replace(/channel_binding=require&?/g, "")
      .replace("?sslmode=require", "?sslmode=require&connect_timeout=30");

    const config: PoolConfig = {
      connectionString: connectionUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
      ssl: {
        rejectUnauthorized: false,
      },
    };

    poolInstance = new Pool(config);

    poolInstance.on('error', (err) => {
      logger.error('DB_POOL_CONFIG', 'Unexpected error on idle client', err);
    });
  }

  return poolInstance;
}

export const pool = {
  query: async (text: string, params?: unknown[]) => {
    return getPool().query(text, params);
  },
};

export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}
