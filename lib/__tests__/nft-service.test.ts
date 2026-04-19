/**
 * NFT Service Tests
 * lib/__tests__/nft-service.test.ts
 */

import { NFTService } from "@/lib/services/nft.service";

// Mock dependencies
jest.mock("@/lib/repositories/nft.repository");
jest.mock("@/lib/services/ipfs.service");
jest.mock("@/lib/blockchain/contract", () => ({
  mintProductNFT: jest.fn(),
  getTokenOwner: jest.fn(),
  getTokenProperties: jest.fn(),
}));
jest.mock("@/lib/blockchain/errors-sui", () => ({
  parseSuiError: jest.fn(),
}));

import { NFTRepository } from "@/lib/repositories/nft.repository";
import { mintProductNFT, getTokenOwner, getTokenProperties } from "@/lib/blockchain/contract";
import { parseSuiError } from "@/lib/blockchain/errors-sui";

const mockMintProductNFT = mintProductNFT as jest.MockedFunction<typeof mintProductNFT>;
const mockGetTokenOwner = getTokenOwner as jest.MockedFunction<typeof getTokenOwner>;
const mockGetTokenProperties = getTokenProperties as jest.MockedFunction<typeof getTokenProperties>;
const mockParseSuiError = parseSuiError as jest.MockedFunction<typeof parseSuiError>;

describe("NFTService", () => {
  let nftService: NFTService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockNftRepo: Record<string, jest.Mock<(...args: any[]) => any>>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockNftRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByOwner: jest.fn(),
      findByStatus: jest.fn(),
      updateStatus: jest.fn(),
    };

    // Set environment variables
    process.env.OWNER_PRIVATE_KEY = "0x" + "d".repeat(64);

    nftService = new NFTService(
      mockNftRepo as any,
      { getMetadata: jest.fn() } as any
    );
  });

  describe("mintNFT", () => {
    it("should return error when ipfsHash is missing", async () => {
      const result = await nftService.mintNFT({
        ipfsHash: "",
        account: "0xtest",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Thiếu thông tin: ipfsHash và account là bắt buộc");
    });

    it("should return error when account is missing", async () => {
      const result = await nftService.mintNFT({
        ipfsHash: "QmTest",
        account: "",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Thiếu thông tin: ipfsHash và account là bắt buộc");
    });

    it("should return error when OWNER_PRIVATE_KEY is not set", async () => {
      delete process.env.OWNER_PRIVATE_KEY;

      const freshService = new NFTService(
        mockNftRepo as unknown as NFTRepository,
        { getMetadata: jest.fn() } as any
      );
      const result = await freshService.mintNFT({
        ipfsHash: "QmTest",
        account: "0xtest",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("OWNER_PRIVATE_KEY không được cấu hình");
    });

    it("should mint NFT successfully", async () => {
      mockMintProductNFT.mockResolvedValueOnce({
        success: true,
        digest: "test-digest-123",
        objectId: "0xabc",
      });
      (mockNftRepo as any).create.mockResolvedValueOnce({
        id: 1,
        name: "NFT-1",
        status: "minted",
        manufacturer_address: "0xtest",
        ipfs_hash: "QmTest",
        batch_number: "BATCH-1",
      } as any);

      const result = await nftService.mintNFT({
        ipfsHash: "QmTest",
        account: "0xtest",
        batchNumber: "BATCH-1",
      });

      expect(result.success).toBe(true);
      expect(result.nft).toBeDefined();
      expect(result.transactionHash).toBe("test-digest-123");
      expect(result.explorerUrl).toBeDefined();
    });

    it("should return error when blockchain minting fails", async () => {
      mockMintProductNFT.mockResolvedValueOnce({
        success: false,
        error: "Blockchain error",
      } as any);

      const result = await nftService.mintNFT({
        ipfsHash: "QmTest",
        account: "0xtest",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Blockchain error");
    });

    it("should handle exceptions during minting", async () => {
      mockMintProductNFT.mockRejectedValueOnce(new Error("Unexpected error"));
      mockParseSuiError.mockReturnValueOnce("Parsed error");

      const result = await nftService.mintNFT({
        ipfsHash: "QmTest",
        account: "0xtest",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Parsed error");
    });

    it("should use default batch number if not provided", async () => {
      mockMintProductNFT.mockResolvedValueOnce({
        success: true,
        digest: "test-digest",
      });
      (mockNftRepo as any).create.mockResolvedValueOnce({ id: 1 } as any);

      await nftService.mintNFT({
        ipfsHash: "QmTest",
        account: "0xtest",
      });

      expect(mockMintProductNFT).toHaveBeenCalledWith(
        "QmTest",
        expect.stringContaining("BATCH-"),
        expect.any(Number),
        expect.any(String)
      );
    });
  });

  describe("getNFTWithMetadata", () => {
    it("should return null when NFT not found in database", async () => {
      (mockNftRepo as any).findById.mockResolvedValueOnce(null as any);

      const result = await nftService.getNFTWithMetadata(1);
      expect(result).toBeNull();
    });

    it("should return NFT with full metadata", async () => {
      (mockNftRepo as any).findById.mockResolvedValueOnce({
        id: 1,
        name: "TestNFT",
        status: "minted",
        manufacturer_address: "0xtest",
        ipfs_hash: "QmTest",
        batch_number: "BATCH-1",
        created_at: new Date().toISOString(),
      } as any);
      mockGetTokenOwner.mockResolvedValueOnce("0xtest");
      mockGetTokenProperties.mockResolvedValueOnce({} as any);
      (nftService as any).ipfsService.getMetadata = jest.fn().mockResolvedValueOnce({
        name: "Test Drug",
        description: "Test description",
      });

      const result = await nftService.getNFTWithMetadata(1);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.name).toBe("TestNFT");
      expect(result?.blockchainOwner).toBe("0xtest");
    });

    it("should handle blockchain data fetch errors gracefully", async () => {
      (mockNftRepo as any).findById.mockResolvedValueOnce({
        id: 1,
        name: "TestNFT",
        status: "minted",
        manufacturer_address: "0xtest",
        ipfs_hash: "QmTest",
        batch_number: "BATCH-1",
        created_at: new Date().toISOString(),
      } as any);
      mockGetTokenOwner.mockRejectedValueOnce(new Error("Blockchain error"));

      const result = await nftService.getNFTWithMetadata(1);

      // Should still return NFT data even if blockchain fetch fails
      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.blockchainOwner).toBeUndefined();
    });
  });

  describe("getNFTsByOwner", () => {
    it("should return NFTs by owner", async () => {
      const mockNFTs = { nfts: [{ id: 1 }], total: 1 };
      (mockNftRepo as any).findByOwner.mockResolvedValueOnce(mockNFTs);

      const result = await nftService.getNFTsByOwner("0xtest");

      expect(result.nfts).toEqual(mockNFTs.nfts);
      expect(result.total).toBe(1);
      expect((mockNftRepo as any).findByOwner).toHaveBeenCalledWith("0xtest");
    });

    it("should return empty result on error", async () => {
      (mockNftRepo as any).findByOwner.mockRejectedValueOnce(new Error("DB error"));

      const result = await nftService.getNFTsByOwner("0xtest");

      expect(result.nfts).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe("updateStatus", () => {
    it("should update NFT status successfully", async () => {
      (mockNftRepo as any).updateStatus.mockResolvedValueOnce({ id: 1 } as any);

      const result = await nftService.updateStatus(1, "minted");

      expect(result).toBe(true);
      expect((mockNftRepo as any).updateStatus).toHaveBeenCalledWith(1, "minted", undefined, undefined);
    });

    it("should return false on error", async () => {
      (mockNftRepo as any).updateStatus.mockRejectedValueOnce(new Error("DB error"));

      const result = await nftService.updateStatus(1, "minted");

      expect(result).toBe(false);
    });

    it("should pass address and type when provided", async () => {
      (mockNftRepo as any).updateStatus.mockResolvedValueOnce({ id: 1 } as any);

      await nftService.updateStatus(1, "in_transit", "0xdist", "distributor");

      expect((mockNftRepo as any).updateStatus).toHaveBeenCalledWith(
        1,
        "in_transit",
        "0xdist",
        "distributor"
      );
    });
  });

  describe("getNFTsByStatus", () => {
    it("should return NFTs by status", async () => {
      const mockNFTs = [{ id: 1, status: "minted" }];
      (mockNftRepo as any).findByStatus.mockResolvedValueOnce({ nfts: mockNFTs, total: 1 });

      const result = await nftService.getNFTsByStatus("minted");

      expect(result).toEqual(mockNFTs);
    });

    it("should return empty array on error", async () => {
      (mockNftRepo as any).findByStatus.mockRejectedValueOnce(new Error("DB error"));

      const result = await nftService.getNFTsByStatus("minted");

      expect(result).toEqual([]);
    });
  });
});
