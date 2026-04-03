/**
 * Role Authorization Tests
 * lib/__tests__/role-auth.test.ts
 */

import {
  Role,
  VALID_ROLES,
  RolePermissions,
  roleAuthService,
} from "@/lib/auth/role-auth";

// Mock the pool from db module
jest.mock("@/lib/db", () => ({
  pool: {
    query: jest.fn(),
  },
}));

import { pool } from "@/lib/db";

const mockPool = pool as jest.Mocked<typeof pool>;

describe("Role Authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Role enum", () => {
    it("should have all expected roles", () => {
      expect(Role.MANUFACTURER).toBe("MANUFACTURER");
      expect(Role.DISTRIBUTOR).toBe("DISTRIBUTOR");
      expect(Role.PHARMACY).toBe("PHARMACY");
      expect(Role.ADMIN).toBe("ADMIN");
    });
  });

  describe("VALID_ROLES", () => {
    it("should contain all 4 roles", () => {
      expect(VALID_ROLES).toContain(Role.MANUFACTURER);
      expect(VALID_ROLES).toContain(Role.DISTRIBUTOR);
      expect(VALID_ROLES).toContain(Role.PHARMACY);
      expect(VALID_ROLES).toContain(Role.ADMIN);
      expect(VALID_ROLES).toHaveLength(4);
    });
  });

  describe("RolePermissions", () => {
    it("should define MANUFACTURER permissions", () => {
      expect(RolePermissions[Role.MANUFACTURER]).toContain("create_nft");
      expect(RolePermissions[Role.MANUFACTURER]).toContain("upload_ipfs");
      expect(RolePermissions[Role.MANUFACTURER]).toContain("mint_nft");
      expect(RolePermissions[Role.MANUFACTURER]).toContain("view_own_nfts");
    });

    it("should define DISTRIBUTOR permissions", () => {
      expect(RolePermissions[Role.DISTRIBUTOR]).toContain("receive_nft");
      expect(RolePermissions[Role.DISTRIBUTOR]).toContain("update_status");
      expect(RolePermissions[Role.DISTRIBUTOR]).toContain("add_milestone");
      expect(RolePermissions[Role.DISTRIBUTOR]).toContain("transfer_to_pharmacy");
    });

    it("should define PHARMACY permissions", () => {
      expect(RolePermissions[Role.PHARMACY]).toContain("receive_nft");
      expect(RolePermissions[Role.PHARMACY]).toContain("verify_nft");
      expect(RolePermissions[Role.PHARMACY]).toContain("confirm_receipt");
      expect(RolePermissions[Role.PHARMACY]).toContain("view_inventory");
    });

    it("should define ADMIN permissions", () => {
      expect(RolePermissions[Role.ADMIN]).toContain("assign_role");
      expect(RolePermissions[Role.ADMIN]).toContain("view_all_nfts");
      expect(RolePermissions[Role.ADMIN]).toContain("view_all_users");
      expect(RolePermissions[Role.ADMIN]).toContain("manage_system");
    });

    it("should have no overlapping permissions across roles", () => {
      const allPermissions = Object.values(RolePermissions).flat();
      const uniquePermissions = new Set(allPermissions);
      // All permissions should be unique (no shared permissions)
      expect(allPermissions.length).toBe(uniquePermissions.size);
    });
  });

  describe("roleAuthService.getUserRole", () => {
    const testAddress = "0xtestaddress123";

    it("should return role when user exists", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ address: testAddress, role: "MANUFACTURER", assigned_at: new Date().toISOString() }],
      });

      const role = await roleAuthService.getUserRole(testAddress);
      expect(role).toBe("MANUFACTURER");
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT role FROM users WHERE address = $1",
        [testAddress.toLowerCase()]
      );
    });

    it("should return null when user does not exist", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const role = await roleAuthService.getUserRole(testAddress);
      expect(role).toBeNull();
    });

    it("should convert address to lowercase", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await roleAuthService.getUserRole("0xTestAddress");
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT role FROM users WHERE address = $1",
        ["0xtestaddress"]
      );
    });

    it("should throw on database error", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("DB connection failed"));

      await expect(roleAuthService.getUserRole(testAddress)).rejects.toThrow("DB connection failed");
    });
  });

  describe("roleAuthService.hasPermission", () => {
    const testAddress = "0xtestaddress";

    it("should return true when user has permission", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ address: testAddress, role: "MANUFACTURER" }],
      });

      const hasPermission = await roleAuthService.hasPermission(testAddress, "create_nft");
      expect(hasPermission).toBe(true);
    });

    it("should return false when user does not have permission", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ address: testAddress, role: "MANUFACTURER" }],
      });

      const hasPermission = await roleAuthService.hasPermission(testAddress, "assign_role");
      expect(hasPermission).toBe(false);
    });

    it("should return false when user does not exist", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const hasPermission = await roleAuthService.hasPermission(testAddress, "create_nft");
      expect(hasPermission).toBe(false);
    });

    it("should return false on database error", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("DB error"));

      const hasPermission = await roleAuthService.hasPermission(testAddress, "create_nft");
      expect(hasPermission).toBe(false);
    });
  });

  describe("roleAuthService.assignRole", () => {
    const testAddress = "0xtestaddress";

    it("should upsert user with role", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ address: testAddress.toLowerCase(), role: "DISTRIBUTOR", assigned_at: new Date().toISOString() }],
      });

      await roleAuthService.assignRole(testAddress, Role.DISTRIBUTOR);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO users"),
        [testAddress.toLowerCase(), "DISTRIBUTOR", expect.any(String)]
      );
    });

    it("should throw on database error", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("DB error"));

      await expect(roleAuthService.assignRole(testAddress, Role.PHARMACY)).rejects.toThrow("DB error");
    });
  });

  describe("roleAuthService.isAdmin", () => {
    const testAddress = "0xadminaddress";

    it("should return true when user is admin", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ address: testAddress, role: "ADMIN" }],
      });

      const isAdmin = await roleAuthService.isAdmin(testAddress);
      expect(isAdmin).toBe(true);
    });

    it("should return false when user is not admin", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ address: testAddress, role: "MANUFACTURER" }],
      });

      const isAdmin = await roleAuthService.isAdmin(testAddress);
      expect(isAdmin).toBe(false);
    });

    it("should return false when user does not exist", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const isAdmin = await roleAuthService.isAdmin(testAddress);
      expect(isAdmin).toBe(false);
    });
  });
});
