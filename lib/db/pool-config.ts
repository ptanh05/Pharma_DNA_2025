/**
 * Database Connection Pool Optimization
 * lib/db/pool-config.ts
 */

export const POOL_CONFIG = {
  // Production settings
  production: {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
  },

  // Serverless settings
  serverless: {
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  },

  // Development settings
  development: {
    max: 5,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 20000,
  },
};

export function getPoolConfig() {
  const env = process.env.NODE_ENV || "development";
  const isServerless = process.env.VERCEL === "1";

  if (isServerless) {
    return POOL_CONFIG.serverless;
  }

  return POOL_CONFIG[env as keyof typeof POOL_CONFIG] || POOL_CONFIG.development;
}

