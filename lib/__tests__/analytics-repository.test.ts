// @ts-nocheck
/**
 * Analytics Repository Tests
 * lib/__tests__/analytics-repository.test.ts
 */

import { AnalyticsRepository } from "@/lib/repositories/analytics.repository";

jest.mock("@/lib/db", () => ({
  pool: {
    query: jest.fn(),
  },
}));

import { pool } from "@/lib/db";

const mockPool = pool as jest.Mocked<typeof pool>;

describe("AnalyticsRepository", () => {
  let analyticsRepo: AnalyticsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
    analyticsRepo = new AnalyticsRepository();
  });

  // ─── getSupplyChainFunnel ──────────────────────────────────────────────────

  describe("getSupplyChainFunnel", () => {
    it("should return parsed funnel data with numbers (not strings)", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          minted: "5",
          at_distributor: "3",
          at_pharmacy: "1",
          dispensed: "2",
          total: "11",
        }],
      });

      const result = await analyticsRepo.getSupplyChainFunnel();

      expect(result.minted).toBe(5);
      expect(result.at_distributor).toBe(3);
      expect(result.at_pharmacy).toBe(1);
      expect(result.dispensed).toBe(2);
      expect(result.total).toBe(11);
      expect(typeof result.minted).toBe("number");
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining("COUNT(*) FILTER"));
    });

    it("should handle null/undefined counts gracefully", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          minted: null,
          at_distributor: null,
          at_pharmacy: null,
          dispensed: null,
          total: null,
        }],
      });

      const result = await analyticsRepo.getSupplyChainFunnel();

      expect(result.minted).toBe(0);
      expect(result.at_distributor).toBe(0);
      expect(result.at_pharmacy).toBe(0);
      expect(result.dispensed).toBe(0);
      expect(result.total).toBe(0);
    });

    it("should throw when database query fails", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("DB connection failed"));

      await expect(analyticsRepo.getSupplyChainFunnel()).rejects.toThrow("DB connection failed");
    });
  });

  // ─── getNFTHealth ──────────────────────────────────────────────────────────

  describe("getNFTHealth", () => {
    it("should return parsed health data with numbers", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          expiring_30d: "2",
          expiring_7d: "1",
          expired: "0",
          total: "10",
        }],
      });

      const result = await analyticsRepo.getNFTHealth();

      expect(result.expiring_30d).toBe(2);
      expect(result.expiring_7d).toBe(1);
      expect(result.expired).toBe(0);
      expect(result.total).toBe(10);
      expect(typeof result.expiring_30d).toBe("number");
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining("expiring_30d"));
    });

    it("should handle missing/null values", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          expiring_30d: null,
          expiring_7d: null,
          expired: null,
          total: null,
        }],
      });

      const result = await analyticsRepo.getNFTHealth();

      expect(result.expiring_30d).toBe(0);
      expect(result.expiring_7d).toBe(0);
      expect(result.expired).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  // ─── getSensorAlerts ───────────────────────────────────────────────────────

  describe("getSensorAlerts", () => {
    it("should return sensor alerts with parsed numeric fields", async () => {
      const mockRows = [
        {
          nft_id: 1,
          batch_number: "BATCH-001",
          temperature: "6.5",
          humidity: "55.0",
          gps_location: "Hanoi",
          recorded_at: "2026-04-01T10:00:00Z",
          severity: "warning",
        },
        {
          nft_id: 2,
          batch_number: null,
          temperature: "9.2",
          humidity: null,
          gps_location: null,
          recorded_at: "2026-04-01T11:00:00Z",
          severity: "critical",
        },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockRows });

      const result = await analyticsRepo.getSensorAlerts(60);

      expect(result).toHaveLength(2);
      expect(result[0].nft_id).toBe(1);
      expect(result[0].temperature).toBe(6.5);
      expect(result[0].humidity).toBe(55.0);
      expect(result[0].batch_number).toBe("BATCH-001");
      expect(result[1].nft_id).toBe(2);
      expect(result[1].temperature).toBe(9.2);
      expect(result[1].humidity).toBeNull();
      expect(result[1].batch_number).toBeUndefined();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("sensor_data"),
        [60]
      );
    });

    it("should return empty array when no alerts found", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await analyticsRepo.getSensorAlerts(60);

      expect(result).toEqual([]);
    });

    it("should default to 60 minutes when called without argument", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await analyticsRepo.getSensorAlerts();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        [60]
      );
    });
  });

  // ─── getUnresolvedQualityAlerts ────────────────────────────────────────────

  describe("getUnresolvedQualityAlerts", () => {
    it("should return unresolved quality alerts sorted by severity", async () => {
      const mockRows = [
        {
          id: 1,
          nft_id: 10,
          batch_number: "BATCH-X",
          severity: "critical",
          alert_type: "temperature",
          description: "High temperature detected",
          location: "Warehouse A",
          nft_name: "Drug NFT",
          manufacturer_address: "0xtest",
        },
        {
          id: 2,
          nft_id: 20,
          batch_number: null,
          severity: "warning",
          alert_type: null,
          description: null,
          location: null,
          nft_name: null,
          manufacturer_address: null,
        },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockRows });

      const result = await analyticsRepo.getUnresolvedQualityAlerts();

      expect(result).toHaveLength(2);
      expect(result[0].severity).toBe("critical");
      expect(result[1].severity).toBe("warning");
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining("quality_alerts"));
    });

    it("should return empty array when no unresolved alerts", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await analyticsRepo.getUnresolvedQualityAlerts();

      expect(result).toEqual([]);
    });
  });

  // ─── getNFTCreationTrend ──────────────────────────────────────────────────

  describe("getNFTCreationTrend", () => {
    it("should return trend points with parsed count and cumulative", async () => {
      const mockRows = [
        { date: "2026-04-01", count: "3", cumulative: "3" },
        { date: "2026-04-02", count: "5", cumulative: "8" },
        { date: "2026-04-03", count: "2", cumulative: "10" },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockRows });

      const result = await analyticsRepo.getNFTCreationTrend(30);

      expect(result).toHaveLength(3);
      expect(result[0].date).toBe("2026-04-01");
      expect(result[0].count).toBe(3);
      expect(result[0].cumulative).toBe(3);
      expect(result[2].count).toBe(2);
      expect(result[2].cumulative).toBe(10);
      expect(typeof result[0].count).toBe("number");
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("nfts"),
        [30]
      );
    });

    it("should default to 30 days when called without argument", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await analyticsRepo.getNFTCreationTrend();

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [30]);
    });

    it("should return empty array when no NFTs created", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await analyticsRepo.getNFTCreationTrend(30);

      expect(result).toEqual([]);
    });
  });

  // ─── getMilestoneHeatmap ───────────────────────────────────────────────────

  describe("getMilestoneHeatmap", () => {
    it("should return heatmap matrix with maxCount", async () => {
      const mockRows = [
        { date: "2026-04-01", day_of_week: "1", hour: "9", count: "5" },
        { date: "2026-04-01", day_of_week: "2", hour: "14", count: "12" },
        { date: "2026-04-02", day_of_week: "3", hour: "10", count: "3" },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockRows });

      const result = await analyticsRepo.getMilestoneHeatmap(30);

      expect(result.heatmap["1"]["9"]).toBe(5);
      expect(result.heatmap["2"]["14"]).toBe(12);
      expect(result.heatmap["3"]["10"]).toBe(3);
      expect(result.maxCount).toBe(12);
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining("milestones"), [30]);
    });

    it("should return zero-initialized 7x24 matrix when no data", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await analyticsRepo.getMilestoneHeatmap(30);

      expect(result.maxCount).toBe(0);
      expect(result.heatmap["0"]["0"]).toBe(0);
      expect(result.heatmap["6"]["23"]).toBe(0);
      // verify all 7 days × 24 hours are present
      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
          expect(result.heatmap[d.toString()][h]).toBe(0);
        }
      }
    });
  });

  // ─── getActivityHeatmap ────────────────────────────────────────────────────

  describe("getActivityHeatmap", () => {
    it("should return activity heatmap with numeric keys and maxCount", async () => {
      const mockRows = [
        { day_of_week: "0", hour: "8", count: "4" },
        { day_of_week: "4", hour: "17", count: "20" },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockRows });

      const result = await analyticsRepo.getActivityHeatmap(30);

      expect(result.heatmap[0][8]).toBe(4);
      expect(result.heatmap[4][17]).toBe(20);
      expect(result.maxCount).toBe(20);
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining("milestones"), [30]);
    });

    it("should return zero-initialized 7x24 matrix when no activity", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await analyticsRepo.getActivityHeatmap(30);

      expect(result.maxCount).toBe(0);
      expect(result.heatmap[0][0]).toBe(0);
      expect(result.heatmap[6][23]).toBe(0);
    });

    it("should default to 30 days", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await analyticsRepo.getActivityHeatmap();

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [30]);
    });
  });

  // ─── getDispensingTrend ────────────────────────────────────────────────────

  describe("getDispensingTrend", () => {
    it("should return dispensing trend rows with parsed values", async () => {
      const mockRows = [
        { date: "2026-04-01", count: "2", total_quantity: "100" },
        { date: "2026-04-02", count: "5", total_quantity: "250" },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockRows });

      const result = await analyticsRepo.getDispensingTrend(30);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe("2026-04-01");
      expect(result[0].count).toBe(2);
      expect(result[0].cumulative).toBe(100);
      expect(result[1].count).toBe(5);
      expect(result[1].cumulative).toBe(250);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("dispensing_records"),
        [30]
      );
    });

    it("should return empty array when no dispensing records", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await analyticsRepo.getDispensingTrend(30);

      expect(result).toEqual([]);
    });

    it("should default to 30 days", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await analyticsRepo.getDispensingTrend();

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [30]);
    });
  });

  // ─── getExpiringNFTs ──────────────────────────────────────────────────────

  describe("getExpiringNFTs", () => {
    it("should return expiring NFTs within the specified days", async () => {
      const mockRows = [
        {
          id: 1,
          name: "Drug-A",
          batch_number: "BATCH-A",
          expiry_date: "2026-05-01",
          manufacturer_address: "0xmfg",
          status: "at_pharmacy",
        },
        {
          id: 2,
          name: "Drug-B",
          batch_number: "BATCH-B",
          expiry_date: "2026-05-10",
          manufacturer_address: "0xmfg2",
          status: "at_pharmacy",
        },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockRows });

      const result = await analyticsRepo.getExpiringNFTs(30);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].name).toBe("Drug-A");
      expect(result[0].expiry_date).toBe("2026-05-01");
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("nfts"),
        [30]
      );
    });

    it("should return empty array when no NFTs expiring soon", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await analyticsRepo.getExpiringNFTs(30);

      expect(result).toEqual([]);
    });

    it("should default to 30 days", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await analyticsRepo.getExpiringNFTs();

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [30]);
    });
  });
});
