/**
 * Health Check Utility
 * Check system health and dependencies
 */

import { pool } from "@/lib/db";
import { getSuiClient }from "@/lib/blockchain/provider-sui";
import { logger } from "./logger";

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: {
    database: boolean;
    blockchain: boolean;
    environment: boolean;
  };
  details?: any;
}

/**
 * Check database connection
 */
export async function checkDatabase(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    logger.info("health-check", "Database connection OK");
    return true;
  } catch (error) {
    logger.error("health-check", "Database connection failed", error);
    return false;
  }
}

/**
 * Check blockchain connection
 */
export async function checkBlockchain(): Promise<boolean> {
  try {
    const client = getSuiClient();
    await client.getLatestSuiSystemState();
    logger.info("health-check", "Blockchain connection OK");
    return true;
  } catch (error) {
    logger.error("health-check", "Blockchain connection failed", error);
    return false;
  }
}

/**
 * Check environment variables
 */
export function checkEnvironment(): boolean {
  const required = [
    "DATABASE_URL",
    "BLOCKCHAIN_NETWORK",
    "OWNER_PRIVATE_KEY",
    "OPENAI_API_KEY",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    logger.error("health-check", "Missing environment variables", { missing });
    return false;
  }

  logger.info("health-check", "Environment variables OK");
  return true;
}

/**
 * Get overall health status
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const [dbOk, blockchainOk, envOk] = await Promise.all([
    checkDatabase(),
    checkBlockchain(),
    Promise.resolve(checkEnvironment()),
  ]);

  const status =
    dbOk && blockchainOk && envOk
      ? "healthy"
      : dbOk && blockchainOk
        ? "degraded"
        : "unhealthy";

  return {
    status,
    timestamp: new Date().toISOString(),
    checks: {
      database: dbOk,
      blockchain: blockchainOk,
      environment: envOk,
    },
  };
}

