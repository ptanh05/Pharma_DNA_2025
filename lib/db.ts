import { Pool } from "pg";

// Global type for development HMR
declare global {
  var _postgresPool: Pool | undefined;
}

// Vercel serverless-optimized connection pool config
const getPoolConfig = () => {
  const isVercel = process.env.VERCEL === "1";
  
  return {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
    // Optimize for serverless
    max: isVercel ? 1 : 10,
    idleTimeoutMillis: isVercel ? 30000 : 30000,
    connectionTimeoutMillis: isVercel ? 10000 : 10000,
  };
};

// Lazy initialization singleton
const getPool = (): Pool => {
  if (process.env.NODE_ENV === "development") {
    if (!global._postgresPool) {
      global._postgresPool = new Pool(getPoolConfig());
      global._postgresPool.on("error", (err) => {
        console.error("Unexpected database pool error", err);
      });
    }
    return global._postgresPool;
  }

  // In production, always create a new pool (managed by runtime)
  // or use a module-level singleton if preferred, but for serverless 
  // keeping it simple is often safer. However, to avoid recreation on every req:
  if (!global._postgresPool) {
    global._postgresPool = new Pool(getPoolConfig());
    global._postgresPool.on("error", (err) => {
      console.error("Unexpected database pool error", err);
    });
  }
  return global._postgresPool;
};

// Proxy object to maintain API compatibility (import { pool } from '@/lib/db')
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const currentPool = getPool();
    // @ts-ignore
    const value = currentPool[prop];
    
    // Bind functions to the pool instance
    if (typeof value === 'function') {
      return value.bind(currentPool);
    }
    
    return value;
  },
});