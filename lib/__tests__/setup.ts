/**
 * Jest Test Setup
 * lib/__tests__/setup.ts
 */

import "@testing-library/jest-dom";

// Mock environment variables
process.env.JWT_SECRET = "test-jwt-secret-key-that-is-at-least-32-characters-long";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.NEXT_PUBLIC_SUI_RPC_URL = "https://fullnode.devnet.sui.io:443";
process.env.NEXT_PUBLIC_SUI_PACKAGE_ID = "0x" + "a".repeat(64);
process.env.NEXT_PUBLIC_SUI_CONTRACT_OBJECT_ID = "0x" + "b".repeat(64);
process.env.SUI_ADMIN_CAP_OBJECT_ID = "0x" + "c".repeat(64);
process.env.OWNER_PRIVATE_KEY = "0x" + "d".repeat(64);
process.env.FORCE_DB_ONLY = "true";

// Mock Sui client
jest.mock("@mysten/sui.js/client", () => ({
  SuiClient: jest.fn().mockImplementation(() => ({
    getLatestSuiSystemState: jest.fn().mockResolvedValue({}),
    getBalance: jest.fn().mockResolvedValue({ totalBalance: "1000000" }),
    dryRunTransactionBlock: jest.fn().mockResolvedValue({
      effects: { status: { status: "success" } },
      returnValues: [[{ value: 1 }]],
    }),
    signAndExecuteTransactionBlock: jest.fn().mockResolvedValue({
      digest: "test-digest",
      effects: { status: { status: "success" } },
      objectChanges: [],
    }),
    getTransactionBlock: jest.fn().mockResolvedValue({
      effects: { status: { status: "success" } },
      objectChanges: [],
    }),
    getObject: jest.fn().mockResolvedValue({
      data: { owner: "0x" + "a".repeat(64) },
    }),
  })),
  getFullnodeUrl: jest.fn().mockReturnValue("https://fullnode.devnet.sui.io:443"),
}));

// Mock pg Pool
const mockQuery = jest.fn();
jest.mock("@/lib/db", () => ({
  pool: {
    query: mockQuery,
  },
}));

// Re-export mockQuery for use in tests
export { mockQuery };
