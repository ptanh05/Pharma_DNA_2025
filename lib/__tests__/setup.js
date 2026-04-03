/**
 * Jest Test Setup
 * lib/__tests__/setup.js
 */

const hex64 = Array(65).join("a"); // 64 'a' characters

process.env.JWT_SECRET = "test-jwt-secret-key-that-is-at-least-32-characters-long";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.NEXT_PUBLIC_SUI_RPC_URL = "https://fullnode.devnet.sui.io:443";
process.env.NEXT_PUBLIC_SUI_PACKAGE_ID = "0x" + hex64;
process.env.NEXT_PUBLIC_SUI_CONTRACT_OBJECT_ID = "0x" + hex64;
process.env.SUI_ADMIN_CAP_OBJECT_ID = "0x" + hex64;
process.env.OWNER_PRIVATE_KEY = "0x" + hex64;
process.env.FORCE_DB_ONLY = "true";
