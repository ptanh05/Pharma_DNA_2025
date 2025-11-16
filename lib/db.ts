import { Pool } from "pg";

// Vercel serverless-optimized connection pool
const createPool = () => {
  // For Vercel serverless, use smaller pool and connection timeout
  const isVercel = process.env.VERCEL === "1";
  
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
    // Optimize for serverless
    max: isVercel ? 1 : 10, // Single connection for serverless
    idleTimeoutMillis: isVercel ? 30000 : 30000,
    connectionTimeoutMillis: isVercel ? 10000 : 10000,
  });
};

export const pool = createPool();

// Handle pool errors
pool.on("error", (err) => {
  console.error("Unexpected database pool error", err);
});
