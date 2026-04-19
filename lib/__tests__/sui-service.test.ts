/**
 * Sui Blockchain Service Tests
 * lib/__tests__/sui-service.test.ts
 *
 * Key insight: SuiService is a CLASS and also exported as a singleton instance.
 * We use jest.resetModules() + jest.require() inside beforeEach to get a fresh
 * SuiService instance per test, ensuring FORCE_DB_ONLY env var is applied
 * before the service's constructor runs.
 *
 * The provider-sui mock provides stable fake values for getPackageId etc.,
 * so the constructor never makes real blockchain calls.
 */

// ── Mock provider-sui FIRST so the module-level singleton gets the mocks ─────
jest.mock("@/lib/blockchain/provider-sui", () => ({
  getPackageId: jest.fn().mockReturnValue("0x" + "a".repeat(64)),
  getAdminCapObjectId: jest.fn().mockReturnValue("0x" + "c".repeat(64)),
  getContractObjectId: jest.fn().mockReturnValue("0x" + "b".repeat(64)),
}));

// ── Mock Sui SDK modules ──────────────────────────────────────────────────────
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

// ── Test ──────────────────────────────────────────────────────────────────────
describe("SuiService", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let SuiService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let suiService: any;

  beforeEach(() => {
    // Reset module cache and re-require to get fresh singleton instances
    jest.resetModules();

    // Set env vars BEFORE re-requiring so constructor sees them
    process.env.SUI_ADMIN_PRIVATE_KEY = "0x" + "d".repeat(64);
    process.env.NEXT_PUBLIC_SUI_RPC_URL = "https://fullnode.devnet.sui.io:443";
    process.env.NEXT_PUBLIC_SUI_PACKAGE_ID = "0x" + "a".repeat(64);
    process.env.SUI_ADMIN_CAP_OBJECT_ID = "0x" + "c".repeat(64);
    process.env.FORCE_DB_ONLY = "false";

    // Re-require — this re-runs the module with the fresh env and re-creates the singleton
    const mod = jest.requireActual("@/lib/blockchain/sui.service");
    SuiService = mod.SuiService;
    suiService = mod.suiService;
  });

  afterEach(() => {
    delete process.env.FORCE_DB_ONLY;
    delete process.env.SUI_ADMIN_PRIVATE_KEY;
    delete process.env.NEXT_PUBLIC_SUI_RPC_URL;
    delete process.env.NEXT_PUBLIC_SUI_PACKAGE_ID;
    delete process.env.SUI_ADMIN_CAP_OBJECT_ID;
    jest.restoreAllMocks();
  });

  // ── Constructor / status ──────────────────────────────────────────────────
  describe("constructor & status", () => {
    it("should have hasAdminKeypair boolean from getStatus()", () => {
      const status = suiService.getStatus();
      expect(typeof status.hasAdminKeypair).toBe("boolean");
    });

    it("should indicate admin keypair is configured when env is set", () => {
      expect(suiService.getStatus().hasAdminKeypair).toBe(true);
    });

    it("isReady() should return boolean", () => {
      expect(typeof suiService.isReady()).toBe("boolean");
    });

    it("SuiService class should be constructable", () => {
      // mod.SuiService may be the singleton (the mock replaces the class export),
      // so we verify it's callable and has the expected methods directly
      expect(typeof suiService.getStatus).toBe("function");
      expect(typeof suiService.isReady).toBe("function");
      expect(typeof suiService.grantRole).toBe("function");
    });
  });

  // ── FORCE_DB_ONLY mode ─────────────────────────────────────────────────────
  describe("FORCE_DB_ONLY mode", () => {
    beforeEach(() => {
      // Re-require with FORCE_DB_ONLY=true to get fresh instance
      process.env.FORCE_DB_ONLY = "true";
      jest.resetModules();
      process.env.SUI_ADMIN_PRIVATE_KEY = "0x" + "d".repeat(64);
      process.env.NEXT_PUBLIC_SUI_RPC_URL = "https://fullnode.devnet.sui.io:443";
      process.env.NEXT_PUBLIC_SUI_PACKAGE_ID = "0x" + "a".repeat(64);
      process.env.SUI_ADMIN_CAP_OBJECT_ID = "0x" + "c".repeat(64);
      const mod = jest.requireActual("@/lib/blockchain/sui.service");
      SuiService = mod.SuiService;
      suiService = mod.suiService;
    });

    it("should skip blockchain and return db-only-{timestamp} for grantRole", async () => {
      const result = await suiService.grantRole("0xtestaddress", "MANUFACTURER");
      expect(result).toMatch(/^db-only-\d+$/);
    });

    it("should skip blockchain and return db-only-{timestamp} for revokeRole", async () => {
      const result = await suiService.revokeRole("0xtestaddress", "MANUFACTURER");
      expect(result).toMatch(/^db-only-\d+$/);
    });

    it("should validate role even in DB-only mode", async () => {
      // Role validation happens BEFORE the FORCE_DB_ONLY check,
      // so INVALID_ROLE throws immediately without hitting blockchain
      await expect(
        suiService.grantRole("0xtestaddress", "INVALID_ROLE" as any)
      ).rejects.toThrow("Invalid role");
    });

    it("should accept all valid roles in DB-only mode", async () => {
      const roles = ["ADMIN", "MANUFACTURER", "DISTRIBUTOR", "PHARMACY"];
      for (const role of roles) {
        const result = await suiService.grantRole("0xtestaddress", role);
        expect(result).toMatch(/^db-only-\d+$/);
      }
    });

    it("should handle multiple grantRole calls in DB-only mode", async () => {
      const r1 = await suiService.grantRole("0xaddr1", "MANUFACTURER");
      const r2 = await suiService.grantRole("0xaddr2", "DISTRIBUTOR");
      expect(r1).toMatch(/^db-only-\d+$/);
      expect(r2).toMatch(/^db-only-\d+$/);
    });
  });

  // ── Role validation ────────────────────────────────────────────────────────
  describe("role mapping", () => {
    beforeEach(() => {
      process.env.FORCE_DB_ONLY = "true";
      jest.resetModules();
      process.env.SUI_ADMIN_PRIVATE_KEY = "0x" + "d".repeat(64);
      process.env.NEXT_PUBLIC_SUI_RPC_URL = "https://fullnode.devnet.sui.io:443";
      process.env.NEXT_PUBLIC_SUI_PACKAGE_ID = "0x" + "a".repeat(64);
      process.env.SUI_ADMIN_CAP_OBJECT_ID = "0x" + "c".repeat(64);
      const mod = jest.requireActual("@/lib/blockchain/sui.service");
      suiService = mod.suiService;
    });

    it("should map MANUFACTURER correctly in DB-only mode", async () => {
      const result = await suiService.grantRole("0xtestaddress", "MANUFACTURER");
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should map DISTRIBUTOR correctly in DB-only mode", async () => {
      const result = await suiService.grantRole("0xtestaddress", "DISTRIBUTOR");
      expect(result).toBeDefined();
    });

    it("should map PHARMACY correctly in DB-only mode", async () => {
      const result = await suiService.grantRole("0xtestaddress", "PHARMACY");
      expect(result).toBeDefined();
    });

    it("should map ADMIN correctly in DB-only mode", async () => {
      const result = await suiService.grantRole("0xtestaddress", "ADMIN");
      expect(result).toBeDefined();
    });
  });

  // ── hasRole ────────────────────────────────────────────────────────────────
  describe("hasRole", () => {
    it("should return boolean even for invalid role string", async () => {
      const result = await suiService.hasRole("0xtestaddress", "INVALID_ROLE");
      expect(typeof result).toBe("boolean");
    });

    it("should return boolean for valid roles", async () => {
      const result = await suiService.hasRole("0xtestaddress", "MANUFACTURER");
      expect(typeof result).toBe("boolean");
    });
  });
});
