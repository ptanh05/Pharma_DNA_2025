/**
 * NFT Repository Tests
 * lib/__tests__/nft-repository.test.ts
 */

import { NFTRepository } from "@/lib/repositories/nft.repository";

jest.mock("@/lib/db", () => ({
  pool: {
    query: jest.fn(),
  },
}));

import { pool } from "@/lib/db";

const mockPool = pool as jest.Mocked<typeof pool>;

describe("NFTRepository", () => {
  let nftRepo: NFTRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    nftRepo = new NFTRepository();
  });

  describe("create", () => {
    it("should create NFT with all fields", async () => {
      const mockNFT = {
        id: 1,
        name: "NFT-1",
        status: "minted",
        manufacturer_address: "0xtest",
        ipfs_hash: "QmTest",
        batch_number: "BATCH-1",
        transaction_hash: "0xtxhash",
        distributor_address: null,
        pharmacy_address: null,
        created_at: new Date().toISOString(),
      };
      mockPool.query.mockResolvedValueOnce({ rows: [mockNFT] });

      const result = await nftRepo.create({
        name: "NFT-1",
        status: "minted",
        manufacturerAddress: "0xTest",
        ipfsHash: "QmTest",
        batchNumber: "BATCH-1",
        transactionHash: "0xtxhash",
      });

      expect(result).toEqual(mockNFT);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO nfts"),
        expect.arrayContaining(["NFT-1", "minted", expect.any(String), "0xtest", "QmTest", "BATCH-1"])
      );
    });

    it("should convert manufacturer address to lowercase", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await nftRepo.create({
        name: "Test",
        status: "minted",
        manufacturerAddress: "0xUPPERCASE",
        ipfsHash: "QmTest",
        batchNumber: "B1",
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["0xuppercase"])
      );
    });

    it("should handle optional distributor and pharmacy addresses", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await nftRepo.create({
        name: "Test",
        status: "minted",
        manufacturerAddress: "0xtest",
        ipfsHash: "QmTest",
        batchNumber: "B1",
        distributorAddress: "0xdist",
        pharmacyAddress: "0xpharm",
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["0xdist", "0xpharm"])
      );
    });
  });

  describe("findById", () => {
    it("should return NFT when found", async () => {
      const mockNFT = { id: 1, name: "TestNFT" };
      mockPool.query.mockResolvedValueOnce({ rows: [mockNFT] });

      const result = await nftRepo.findById(1);
      expect(result).toEqual(mockNFT);
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM nfts WHERE id = $1",
        [1]
      );
    });

    it("should return null when not found", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await nftRepo.findById(999);
      expect(result).toBeNull();
    });
  });

  describe("findByOwner", () => {
    it("should return paginated results with total count", async () => {
      // Single query — window COUNT(*) OVER() puts total_count on each row
      const mockNFTs = [
        { id: 1, manufacturer_address: "0xtest", total_count: "2" },
        { id: 2, manufacturer_address: "0xtest", total_count: "2" },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockNFTs });

      const result = await nftRepo.findByOwner("0xtest", 10, 0);

      expect(result.nfts).toEqual(mockNFTs);
      expect(result.total).toBe(2);
    });

    it("should convert owner address to lowercase", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await nftRepo.findByOwner("0xTestAddress");
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ["0xtestaddress"]
      );
    });

    it("should handle undefined limit", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await nftRepo.findByOwner("0xtest");
      // Should use different query when limit is undefined
      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe("findByStatus", () => {
    it("should return paginated results by status", async () => {
      // Single query — window COUNT(*) OVER() puts total_count on each row
      const mockNFTs = [
        { id: 1, status: "minted", total_count: "1" },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockNFTs });

      const result = await nftRepo.findByStatus("minted", 10, 0);

      expect(result.nfts).toEqual(mockNFTs);
      expect(result.total).toBe(1);
    });
  });

  describe("updateStatus", () => {
    it("should update status with manufacturer address", async () => {
      const mockNFT = { id: 1, status: "minted" };
      mockPool.query.mockResolvedValueOnce({ rows: [mockNFT] });

      const result = await nftRepo.updateStatus(1, "minted", "0xtest", "manufacturer");

      expect(result).toEqual(mockNFT);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("manufacturer_address"),
        expect.arrayContaining(["minted", "0xtest"])
      );
    });

    it("should update status with distributor address", async () => {
      const mockNFT = { id: 1, status: "in_transit" };
      mockPool.query.mockResolvedValueOnce({ rows: [mockNFT] });

      const result = await nftRepo.updateStatus(1, "in_transit", "0xdist", "distributor");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("distributor_address"),
        expect.arrayContaining(["in_transit", "0xdist"])
      );
    });

    it("should update status with pharmacy address", async () => {
      const mockNFT = { id: 1, status: "at_pharmacy" };
      mockPool.query.mockResolvedValueOnce({ rows: [mockNFT] });

      const result = await nftRepo.updateStatus(1, "at_pharmacy", "0xpharm", "pharmacy");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("pharmacy_address"),
        expect.arrayContaining(["at_pharmacy", "0xpharm"])
      );
    });

    it("should update status without address", async () => {
      const mockNFT = { id: 1, status: "updated" };
      mockPool.query.mockResolvedValueOnce({ rows: [mockNFT] });

      const result = await nftRepo.updateStatus(1, "updated");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE nfts"),
        expect.arrayContaining(["updated"])
      );
    });
  });

  describe("findByTransactionHash", () => {
    it("should return NFT by transaction hash", async () => {
      const mockNFT = { id: 1, transaction_hash: "0xtxhash" };
      mockPool.query.mockResolvedValueOnce({ rows: [mockNFT] });

      const result = await nftRepo.findByTransactionHash("0xtxhash");
      expect(result).toEqual(mockNFT);
    });

    it("should return null when not found", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await nftRepo.findByTransactionHash("notfound");
      expect(result).toBeNull();
    });
  });

  describe("findByBatchNumber", () => {
    it("should return paginated results by batch number", async () => {
      // Single query — window COUNT(*) OVER() puts total_count on each row
      const mockNFTs = [
        { id: 1, batch_number: "BATCH-1", total_count: "1" },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockNFTs });

      const result = await nftRepo.findByBatchNumber("BATCH-1", 10, 0);

      expect(result.nfts).toEqual(mockNFTs);
      expect(result.total).toBe(1);
    });
  });

  describe("delete", () => {
    it("should soft delete by setting status to deleted", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await nftRepo.delete(1);

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        "UPDATE nfts SET status = $1, updated_at = $2 WHERE id = $3",
        ["deleted", expect.any(String), 1]
      );
    });

    it("should return false on error", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("DB error"));

      const result = await nftRepo.delete(1);
      expect(result).toBe(false);
    });
  });
});
