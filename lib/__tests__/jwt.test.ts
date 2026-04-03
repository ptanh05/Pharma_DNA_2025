// @ts-nocheck
/**
 * JWT Authentication Tests
 * lib/__tests__/jwt.test.ts
 */

import {
  createAccessToken,
  createRefreshToken,
  createTokenPair,
  verifyToken,
  verifyRefreshToken,
  extractTokenFromHeader,
  getTokenTimeRemaining,
  decodeToken,
  type UserPayload,
} from "@/lib/auth/jwt";

const TEST_USER: UserPayload = {
  userId: "test-user-123",
  address: "0xtestaddress",
  role: "MANUFACTURER",
  email: "test@example.com",
};

describe("JWT Authentication", () => {
  describe("createAccessToken", () => {
    it("should create a valid access token", async () => {
      const token = await createAccessToken(TEST_USER);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
    });

    it("should include user payload in token", async () => {
      const token = await createAccessToken(TEST_USER);
      const decoded = decodeToken(token);
      expect(decoded.userId).toBe(TEST_USER.userId);
      expect(decoded.address).toBe(TEST_USER.address);
      expect(decoded.role).toBe(TEST_USER.role);
    });
  });

  describe("createRefreshToken", () => {
    it("should create a valid refresh token", async () => {
      const token = await createRefreshToken(TEST_USER.userId);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("should include userId in refresh token payload", async () => {
      const token = await createRefreshToken(TEST_USER.userId);
      const decoded = decodeToken(token);
      expect(decoded.sub).toBe(TEST_USER.userId);
    });
  });

  describe("createTokenPair", () => {
    it("should create both access and refresh tokens", async () => {
      const tokens = await createTokenPair(TEST_USER);
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBe(24 * 60 * 60); // 24 hours
    });

    it("should create verifiable access token", async () => {
      const tokens = await createTokenPair(TEST_USER);
      const verified = await verifyToken(tokens.accessToken);
      expect(verified.userId).toBe(TEST_USER.userId);
      expect(verified.address).toBe(TEST_USER.address);
      expect(verified.role).toBe(TEST_USER.role);
    });

    it("should create verifiable refresh token", async () => {
      const tokens = await createTokenPair(TEST_USER);
      const verified = await verifyRefreshToken(tokens.refreshToken);
      expect(verified.userId).toBe(TEST_USER.userId);
    });
  });

  describe("verifyToken", () => {
    it("should verify a valid token", async () => {
      const token = await createAccessToken(TEST_USER);
      const verified = await verifyToken(token);
      expect(verified.userId).toBe(TEST_USER.userId);
      expect(verified.address).toBe(TEST_USER.address);
    });

    it("should throw on invalid token", async () => {
      await expect(verifyToken("invalid.token.here")).rejects.toThrow("Invalid token");
    });

    it("should throw on tampered token", async () => {
      const token = await createAccessToken(TEST_USER);
      const parts = token.split(".");
      const tampered = parts[0] + "." + parts[1] + ".invalid_signature";
      await expect(verifyToken(tampered)).rejects.toThrow("Invalid token signature");
    });
  });

  describe("verifyRefreshToken", () => {
    it("should verify a valid refresh token", async () => {
      const token = await createRefreshToken(TEST_USER.userId);
      const verified = await verifyRefreshToken(token);
      expect(verified.userId).toBe(TEST_USER.userId);
    });

    it("should throw on invalid refresh token", async () => {
      await expect(verifyRefreshToken("invalid.refresh.token")).rejects.toThrow("Invalid refresh token");
    });
  });

  describe("extractTokenFromHeader", () => {
    it("should extract token from Bearer header", () => {
      const token = "eyJhbGciOiJIUzI1NiJ9.test";
      const extracted = extractTokenFromHeader(`Bearer ${token}`);
      expect(extracted).toBe(token);
    });

    it("should return null for undefined header", () => {
      expect(extractTokenFromHeader(undefined)).toBeNull();
    });

    it("should return null for empty header", () => {
      expect(extractTokenFromHeader("")).toBeNull();
    });

    it("should return null for non-Bearer header", () => {
      expect(extractTokenFromHeader("Basic abc123")).toBeNull();
    });

    it("should return null for header without Bearer prefix", () => {
      expect(extractTokenFromHeader("just_a_token")).toBeNull();
    });
  });

  describe("getTokenTimeRemaining", () => {
    it("should return positive time for valid token", async () => {
      const token = await createAccessToken(TEST_USER);
      const remaining = await getTokenTimeRemaining(token);
      expect(remaining).toBeGreaterThan(0);
    });

    it("should return time less than 24h for access token", async () => {
      const token = await createAccessToken(TEST_USER);
      const remaining = await getTokenTimeRemaining(token);
      const max24h = 24 * 60 * 60 * 1000;
      expect(remaining).toBeLessThan(max24h);
    });

    it("should return 0 for invalid token", async () => {
      const remaining = await getTokenTimeRemaining("invalid.token");
      expect(remaining).toBe(0);
    });
  });

  describe("decodeToken", () => {
    it("should decode a valid token without verification", async () => {
      const token = await createAccessToken(TEST_USER);
      const decoded = decodeToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(TEST_USER.userId);
    });

    it("should return null for invalid token format", () => {
      const decoded = decodeToken("not-a-valid-jwt");
      expect(decoded).toBeNull();
    });

    it("should handle all supported roles", async () => {
      const roles = ["MANUFACTURER", "DISTRIBUTOR", "PHARMACY", "ADMIN", "CONSUMER"] as const;
      for (const role of roles) {
        const user: UserPayload = { ...TEST_USER, role };
        const token = await createAccessToken(user);
        const decoded = decodeToken(token);
        expect(decoded?.role).toBe(role);
      }
    });
  });
});
