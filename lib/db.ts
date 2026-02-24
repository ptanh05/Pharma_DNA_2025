import { Pool }from "pg";

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
    connectionTimeoutMillis: isVercel ? 10000 : 10000,
  });

  // Handle pool errors
  pool.on("error", (err) => {
    console.error("Unexpected database pool error:", err);
  });

  // Handle connection errors
  pool.on("connect", () => {
    console.log("Database connection established");
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

// Export pool for backward compatibility
export const pool = getPool();

// Graceful shutdown
export const closePool = async (): Promise<void> => {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
    console.log("Database pool closed");
  }
};
