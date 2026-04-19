/**
 * User Repository Tests
 * lib/__tests__/user-repository.test.ts
 */

import { UserRepository } from "@/lib/repositories/user.repository";

jest.mock("@/lib/db", () => ({
  pool: {
    query: jest.fn(),
  },
}));

import { pool } from "@/lib/db";

const mockPool = pool as jest.Mocked<typeof pool>;

describe("UserRepository", () => {
  let userRepo: UserRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepo = new UserRepository();
  });

  describe("upsert", () => {
    it("should upsert user and return the user record", async () => {
      const mockUser = {
        address: "0xtest",
        role: "MANUFACTURER",
        assigned_at: new Date().toISOString(),
      };
      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await userRepo.upsert({ address: "0xTest", role: "MANUFACTURER" });

      expect(result).toEqual(mockUser);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO users"),
        [
          "0xtest",
          "MANUFACTURER",
          expect.any(String), // assigned_at
          null, null, null, null, null, null, null, null, // company info columns (all null)
        ]
      );
    });

    it("should convert address to lowercase", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await userRepo.upsert({ address: "0xUPPERCASE", role: "PHARMACY" });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO users"),
        [
          "0xuppercase",
          "PHARMACY",
          expect.any(String), // assigned_at
          null, null, null, null, null, null, null, null, // company info columns
        ]
      );
    });
  });

  describe("findByAddress", () => {
    it("should return user when found", async () => {
      const mockUser = { address: "0xtest", role: "DISTRIBUTOR" };
      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await userRepo.findByAddress("0xtest");
      expect(result).toEqual(mockUser);
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE address = $1",
        ["0xtest"]
      );
    });

    it("should return null when user not found", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await userRepo.findByAddress("0xnotfound");
      expect(result).toBeNull();
    });

    it("should convert address to lowercase", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await userRepo.findByAddress("0xMixedCase");
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE address = $1",
        ["0xmixedcase"]
      );
    });
  });

  describe("findByRole", () => {
    it("should return all users with a specific role", async () => {
      const mockUsers = [
        { address: "0xuser1", role: "MANUFACTURER" },
        { address: "0xuser2", role: "MANUFACTURER" },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockUsers });

      const result = await userRepo.findByRole("MANUFACTURER");
      expect(result).toEqual(mockUsers);
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE role = $1 ORDER BY assigned_at DESC",
        ["MANUFACTURER"]
      );
    });

    it("should return empty array when no users have the role", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await userRepo.findByRole("ADMIN");
      expect(result).toEqual([]);
    });
  });

  describe("findAll", () => {
    it("should return all users ordered by assigned_at", async () => {
      const mockUsers = [
        { address: "0xuser1", role: "ADMIN" },
        { address: "0xuser2", role: "MANUFACTURER" },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockUsers });

      const result = await userRepo.findAll();
      expect(result).toEqual(mockUsers);
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM users ORDER BY assigned_at DESC"
      );
    });
  });

  describe("delete", () => {
    it("should delete user by address", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await userRepo.delete("0xtest");
      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        "DELETE FROM users WHERE address = $1",
        ["0xtest"]
      );
    });

    it("should convert address to lowercase", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await userRepo.delete("0xMixedCase");
      expect(mockPool.query).toHaveBeenCalledWith(
        "DELETE FROM users WHERE address = $1",
        ["0xmixedcase"]
      );
    });

    it("should return false on error", async () => {
      // Suppress console.error from the catch block in the repo
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      mockPool.query.mockRejectedValueOnce(new Error("DB error"));

      const result = await userRepo.delete("0xtest");

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe("hasRole", () => {
    it("should return true when user has the specified role", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ address: "0xtest", role: "PHARMACY" }],
      });

      const result = await userRepo.hasRole("0xtest", "PHARMACY");
      expect(result).toBe(true);
    });

    it("should return false when user has different role", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ address: "0xtest", role: "MANUFACTURER" }],
      });

      const result = await userRepo.hasRole("0xtest", "PHARMACY");
      expect(result).toBe(false);
    });

    it("should return false when user not found", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await userRepo.hasRole("0xnotfound", "ADMIN");
      expect(result).toBe(false);
    });
  });
});
