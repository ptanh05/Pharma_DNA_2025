/**
 * Environment Configuration
 * Centralized environment variable validation
 */

export interface EnvConfig {
  // Database
  DATABASE_URL: string;
  
  // Blockchain
  BLOCKCHAIN_NETWORK: string;
  SUI_TESTNET_RPC: string;
  SUI_TESTNET_FAUCET: string;
  OWNER_PRIVATE_KEY: string;
  PACKAGE_ID: string;
  CONTRACT_OBJECT_ID: string;
  
  // AI Agent
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  AI_AGENT_AUTO_EXECUTE_ONCHAIN: boolean;
  
  // IPFS
  PINATA_API_KEY: string;
  PINATA_API_SECRET: string;
  
  // Admin
  ADMIN_PASSWORD: string;
  
  // App
  NODE_ENV: string;
  VERCEL: string;
}

/**
 * Validate environment variables
 */
export function validateEnv(): EnvConfig {
  const required = [
    "DATABASE_URL",
    "BLOCKCHAIN_NETWORK",
    "OWNER_PRIVATE_KEY",
    "OPENAI_API_KEY",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    BLOCKCHAIN_NETWORK: process.env.BLOCKCHAIN_NETWORK || "sui-testnet",
    SUI_TESTNET_RPC:
      process.env.SUI_TESTNET_RPC ||
      "https://fullnode.testnet.sui.io:443",
    SUI_TESTNET_FAUCET:
      process.env.SUI_TESTNET_FAUCET ||
      "https://faucet.testnet.sui.io/gas",
    OWNER_PRIVATE_KEY: process.env.OWNER_PRIVATE_KEY!,
    PACKAGE_ID: process.env.PACKAGE_ID || "",
    CONTRACT_OBJECT_ID: process.env.CONTRACT_OBJECT_ID || "",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
    OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
    AI_AGENT_AUTO_EXECUTE_ONCHAIN:
      process.env.AI_AGENT_AUTO_EXECUTE_ONCHAIN !== "false",
    PINATA_API_KEY: process.env.PINATA_API_KEY || "",
    PINATA_API_SECRET: process.env.PINATA_API_SECRET || "",
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "admin",
    NODE_ENV: process.env.NODE_ENV || "development",
    VERCEL: process.env.VERCEL || "0",
  };
}

// Validate on module load
let envConfig: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (!envConfig) {
    envConfig = validateEnv();
  }
  return envConfig;
}

