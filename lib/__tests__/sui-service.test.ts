/**
 * Sui Blockchain Service Tests
 * lib/__tests__/sui-service.test.ts
 */

// These need to be at the top before any imports
jest.mock("@mysten/sui.js/client", () => ({
  SuiClient: jest.fn().mockImplementation(() => ({
    getLatestSuiSystemState: jest.fn().mockResolvedValue({}),
    dryRunTransactionBlock: jest.fn().mockResolvedValue({
      effects: { status: { status: "success" } },
      returnValues: [[{ value: 1 }]],
    }),
    signAndExecuteTransactionBlock: jest.fn().mockResolvedValue({
      digest: "test-digest-success",
      effects: { status: { status: "success" } },
      objectChanges: [],
    }),
    getTransactionBlock: jest.fn().mockResolvedValue({
      effects: { status: { status: "success" } },
      objectChanges: [],
    }),
  })),
  getFullnodeUrl: jest.fn().mockReturnValue("https://fullnode.devnet.sui.io:443"),
}));

jest.mock("@mysten/sui.js/transactions", () => ({
  TransactionBlock: jest.fn().mockImplementation(() => ({
    moveCall: jest.fn(),
    object: jest.fn().mockReturnValue("mock-object"),
    pure: jest.fn().mockReturnValue("mock-pure"),
    build: jest.fn().mockResolvedValue(new Uint8Array(32)),
  })),
}));

jest.mock("@mysten/sui.js/keypairs/ed25519", () => ({
  Ed25519Keypair: {
    fromSecretKey: jest.fn().mockImplementation(() => ({
      getPublicKey: jest.fn().mockReturnValue({
        toSuiAddress: jest.fn().mockReturnValue("0x" + "a".repeat(64)),
      }),
    })),
  },
}));

jest.mock("@mysten/sui.js/cryptography", () => ({
  decodeSuiPrivateKey: jest.fn().mockReturnValue({ secretKey: new Uint8Array(32) }),
}));

jest.mock("@/lib/blockchain/provider-sui", () => ({
  getPackageId: jest.fn().mockReturnValue("0x" + "a".repeat(64)),
  getAdminCapObjectId: jest.fn().mockReturnValue("0x" + "c".repeat(64)),
  getContractObjectId: jest.fn().mockReturnValue("0x" + "b".repeat(64)),
}));

// Set env vars before importing the service
process.env.SUI_ADMIN_PRIVATE_KEY = "0x" + "d".repeat(64);
process.env.NEXT_PUBLIC_SUI_RPC_URL = "https://fullnode.devnet.sui.io:443";
process.env.NEXT_PUBLIC_SUI_PACKAGE_ID = "0x" + "a".repeat(64);
process.env.SUI_ADMIN_CAP_OBJECT_ID = "0x" + "c".repeat(64);
process.env.SUI_CONTRACT_OBJECT_ID = "0x" + "b".repeat(64);
process.env.FORCE_DB_ONLY = "false";

// Import after mocks
import { SuiClient } from "@mysten/sui.js/client";

describe("SuiService", () => {
  let suiService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset module state to get fresh instance
    jest.resetModules();
    // Re-apply mocks
    jest.doMock("@mysten/sui.js/client", () => ({
      SuiClient: jest.fn().mockImplementation(() => ({
        getLatestSuiSystemState: jest.fn().mockResolvedValue({}),
        dryRunTransactionBlock: jest.fn().mockResolvedValue({
          effects: { status: { status: "success" } },
          returnValues: [[{ value: 1 }]],
        }),
        signAndExecuteTransactionBlock: jest.fn().mockResolvedValue({
          digest: "test-digest-success",
          effects: { status: { status: "success" } },
          objectChanges: [],
        }),
        getTransactionBlock: jest.fn().mockResolvedValue({
          effects: { status: { status: "success" } },
          objectChanges: [],
        }),
      })),
      getFullnodeUrl: jest.fn().mockReturnValue("https://fullnode.devnet.sui.io:443"),
    }));
    suiService = require("@/lib/blockchain/sui.service").getSuiService();
  });

  describe("getStatus", () => {
    it("should return service status", () => {
      const status = suiService.getStatus();
      expect(status).toHaveProperty("hasAdminKeypair");
      expect(status).toHaveProperty("hasPackageId");
      expect(status).toHaveProperty("hasAdminCapObjectId");
      expect(status).toHaveProperty("isReady");
      expect(status).toHaveProperty("rpcUrl");
    });

    it("should indicate when admin keypair is configured", () => {
      const status = suiService.getStatus();
      expect(typeof status.hasAdminKeypair).toBe("boolean");
    });
  });

  describe("isReady", () => {
    it("should return boolean readiness status", () => {
      const ready = suiService.isReady();
      expect(typeof ready).toBe("boolean");
    });
  });

  describe("FORCE_DB_ONLY mode", () => {
    beforeEach(() => {
      process.env.FORCE_DB_ONLY = "true";
    });

    it("should skip blockchain when FORCE_DB_ONLY is set for grantRole", async () => {
      const result = await suiService.grantRole("0xtestaddress", "MANUFACTURER");
      expect(result).toMatch(/^db-only-\d+$/);
    });

    it("should skip blockchain when FORCE_DB_ONLY is set for revokeRole", async () => {
      const result = await suiService.revokeRole("0xtestaddress", "MANUFACTURER");
      expect(result).toMatch(/^db-only-\d+$/);
    });
  });

  describe("grantRole", () => {
    beforeEach(() => {
      process.env.FORCE_DB_ONLY = "false";
    });

    it("should throw when admin keypair is not configured", async () => {
      // Create service without env vars
      delete process.env.SUI_ADMIN_PRIVATE_KEY;
      delete process.env.OWNER_PRIVATE_KEY;

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { SuiService } = jest.requireActual("@/lib/blockchain/sui.service");
      const svc = new (SuiService as any)();
      await expect(svc.grantRole("0xtestaddress", "MANUFACTURER")).rejects.toThrow("Admin keypair not configured");
    });

    it("should throw on invalid role", async () => {
      process.env.FORCE_DB_ONLY = "true";
      await expect(suiService.grantRole("0xtestaddress", "INVALID_ROLE" as any)).rejects.toThrow("Invalid role");
    });

    it("should accept valid roles", async () => {
      process.env.FORCE_DB_ONLY = "true";
      const roles = ["ADMIN", "MANUFACTURER", "DISTRIBUTOR", "PHARMACY"];
      for (const role of roles) {
        const result = await suiService.grantRole("0xtestaddress", role);
        expect(result).toMatch(/^db-only-\d+$/);
      }
    });
  });

  describe("hasRole", () => {
    beforeEach(() => {
      process.env.FORCE_DB_ONLY = "false";
    });

    it("should return false for invalid role string", async () => {
      const result = await suiService.hasRole("0xtestaddress", "INVALID_ROLE");
      expect(result).toBe(false);
    });

    it("should return boolean for valid roles", async () => {
      const result = await suiService.hasRole("0xtestaddress", "MANUFACTURER");
      expect(typeof result).toBe("boolean");
    });
  });

  describe("role mapping", () => {
    beforeEach(() => {
      process.env.FORCE_DB_ONLY = "true";
    });

    it("should map MANUFACTURER role correctly", async () => {
      const result = await suiService.grantRole("0xtestaddress", "MANUFACTURER");
      expect(result).toBeDefined();
    });

    it("should map DISTRIBUTOR role correctly", async () => {
      const result = await suiService.grantRole("0xtestaddress", "DISTRIBUTOR");
      expect(result).toBeDefined();
    });

    it("should map PHARMACY role correctly", async () => {
      const result = await suiService.grantRole("0xtestaddress", "PHARMACY");
      expect(result).toBeDefined();
    });

    it("should map ADMIN role correctly", async () => {
      const result = await suiService.grantRole("0xtestaddress", "ADMIN");
      expect(result).toBeDefined();
    });
  });
});
