import { Pool }from "pg";
import { logInfo, logError }from '@/lib/logger';

// Singleton pool instance
let poolInstance: Pool | null = null;
let migrationAttempted = false;

// Run database migrations once per process lifecycle
async function runMigrations(): Promise<void> {
  if (migrationAttempted) return;
  migrationAttempted = true;

  // Lazily import to avoid circular deps — only when DB is actually needed
  try {
    const { TABLE_DEFINITIONS, ensureTableExists } = await import('@/lib/db/table-init');

    // Run in parallel for speed — CREATE TABLE IF NOT EXISTS is safe
    await Promise.allSettled(
      Object.entries(TABLE_DEFINITIONS).map(([name, sql]) =>
        ensureTableExists(name, sql).catch((e) => {
          console.warn(`[DB Init] ${name}: ${e.message}`);
        })
      )
    );

    logInfo('DB', 'All tables initialized');
  } catch (e) {
    console.warn('[DB Init] Migration lazy-load failed, will retry on next request:', e);
    migrationAttempted = false; // allow retry
  }
}

// Vercel serverless-optimized connection pool
const createPool = (): Pool => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const isVercel = process.env.VERCEL === "1";
  const dbUrl = process.env.DATABASE_URL;
  // Chỉ bật SSL khi không phải localhost (production/Vercel/cloud DB)
  const isLocalDb =
    dbUrl.includes("localhost") ||
    dbUrl.includes("127.0.0.1") ||
    dbUrl.includes("::1");
  const sslConfig = isLocalDb ? false : { rejectUnauthorized: false };

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: sslConfig,
    // Optimize for serverless
    max: isVercel ? 5 : 10, // More connections for better concurrency on serverless
    idleTimeoutMillis: isVercel ? 30000 : 30000,
    // Increased timeout for Vercel serverless cold starts with Neon DB
    connectionTimeoutMillis: isVercel ? 30000 : 10000,
  });

  // Handle pool errors
  pool.on('error', (err) => {
    logError('Database pool unexpected error', err);
  });

  // Handle new connections
  pool.on('connect', () => {
    logInfo('Database pool: new connection established');
  });

  return pool;
};

// Get or create pool instance (singleton pattern)
export const getPool = (): Pool => {
  if (!poolInstance) {
    poolInstance = createPool();
  }
  return poolInstance;
};

// Export pool as lazy proxy - does NOT connect at import time
// Triggers migration on first actual query
export const pool = {
  query: async (text: string, params?: any[]) => {
    await runMigrations();
    return getPool().query(text, params);
  },
};

// Graceful shutdown
export const closePool = async (): Promise<void> => {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
    logInfo('Database pool closed');
  }
};
