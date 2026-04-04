import { Pool } from "pg";
import { logInfo, logError } from '@/lib/logger';

// Singleton pool instance - persists within same serverless instance
let poolInstance: Pool | null = null;
// Per-pool migration flag - resets when pool is recreated
let poolMigrated = false;

async function initPoolWithRetry(maxRetries = 3): Promise<Pool> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const dbUrl = process.env.DATABASE_URL;
  const isLocalDb =
    dbUrl.includes("localhost") ||
    dbUrl.includes("127.0.0.1") ||
    dbUrl.includes("::1");

  const poolConfig = {
    connectionString: dbUrl,
    ssl: isLocalDb ? false : { rejectUnauthorized: false },
    max: isLocalDb ? 10 : 3, // Conservative on serverless: 3 connections max
    idleTimeoutMillis: 30000,
    // Generous timeout for cold start — Neon can take time to spin up
    connectionTimeoutMillis: isLocalDb ? 10000 : 60000,
  };

  const pool = new Pool(poolConfig);

  pool.on('error', (err) => {
    logError('Database pool error', err);
  });

  // Test the connection first before returning the pool
  let lastError: Error | null = null;
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      logInfo('DB', `Pool ready (attempt ${i}/${maxRetries})`);
      return pool;
    } catch (err) {
      lastError = err as Error;
      logError(`DB`, `Pool connection attempt ${i}/${maxRetries} failed: ${lastError.message}`);
      if (i < maxRetries) {
        // Wait 2s before retry
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  throw lastError || new Error('Failed to connect to database after retries');
}

async function runMigrations(pool: Pool): Promise<void> {
  if (poolMigrated) return;
  poolMigrated = true;

  try {
    const { TABLE_DEFINITIONS, ensureTableExists } = await import('@/lib/db/table-init');

    // Only migrate the tables we actually need for admin dashboard
    const criticalTables = ['users', 'nfts'];
    for (const name of criticalTables) {
      if (TABLE_DEFINITIONS[name]) {
        try {
          await ensureTableExists(name, TABLE_DEFINITIONS[name]);
        } catch (e) {
          console.warn(`[DB Init] ${name}: ${(e as Error).message}`);
        }
      }
    }

    logInfo('DB', 'Critical tables initialized');
  } catch (e) {
    console.warn('[DB Init] Migration failed:', e);
    poolMigrated = false; // allow retry
  }
}

export const getPool = (): Pool => {
  if (!poolInstance) {
    throw new Error('Database pool not initialized. Call initPool() first.');
  }
  return poolInstance;
};

export async function initPool(): Promise<void> {
  if (poolInstance) return;
  poolInstance = await initPoolWithRetry(3);
  await runMigrations(poolInstance);
}

export const pool = {
  query: async <T = any>(text: string, params?: any[]): Promise<{ rows: T[] }> => {
    if (!poolInstance) {
      await initPool();
    }
    return poolInstance!.query(text, params);
  },
};

// Initialize pool lazily on first use
// This is called by API routes indirectly via pool.query()
export const closePool = async (): Promise<void> => {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
    poolMigrated = false;
    logInfo('DB', 'Pool closed');
  }
};
