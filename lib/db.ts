import { Pool }from "pg";
import { logInfo, logError }from '@/lib/logger';

// Singleton pool instance
let poolInstance: Pool | null = null;

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
    max: isVercel ? 1 : 10, // Single connection for serverless
    idleTimeoutMillis: isVercel ? 30000 : 30000,
    // Reduce connection timeout for faster failure detection
    connectionTimeoutMillis: isVercel ? 5000 : 5000,
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
export const pool = {
  query: async (text: string, params?: any[]) => {
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
