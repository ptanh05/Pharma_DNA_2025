/**
 * Analytics Service Tests
 * lib/__tests__/analytics-service.test.ts
 *
 * Uses jest.require() + jest.spyOn() to mock the analyticsRepository singleton.
 * Also mocks pool.query directly since getNFTStats() calls pool.query itself.
 */

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn() },
}));

import { pool } from "@/lib/db";

const mockPool = pool as jest.Mocked<typeof pool>;

describe("AnalyticsService", () => {
  // Use any to avoid complex import type issues with re-required modules
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let AnalyticsServiceClass: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let analyticsService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let analyticsRepo: any;

  beforeEach(async () => {
    // Reset pool.query mock
    mockPool.query.mockReset();

    // Re-require to get fresh module instances with fresh singletons
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const svc = require("@/lib/services/analytics.service");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const repo = require("@/lib/repositories/analytics.repository");

    AnalyticsServiceClass = svc.AnalyticsService;
    analyticsRepo = repo.analyticsRepository;
    analyticsService = new AnalyticsServiceClass();

    // Spy on the singleton's repository methods
    jest.spyOn(analyticsRepo, "getNFTHealth");
    jest.spyOn(analyticsRepo, "getSupplyChainFunnel");
    jest.spyOn(analyticsRepo, "getExpiringNFTs");
    jest.spyOn(analyticsRepo, "getSensorAlerts");
    jest.spyOn(analyticsRepo, "getUnresolvedQualityAlerts");
    jest.spyOn(analyticsRepo, "getNFTCreationTrend");
    jest.spyOn(analyticsRepo, "getDispensingTrend");
    jest.spyOn(analyticsRepo, "getActivityHeatmap");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── getNFTStats ───────────────────────────────────────────────────────────

  describe("getNFTStats", () => {
    it("should return aggregated NFT stats with health and funnel", async () => {
      // getNFTStats calls pool.query directly (2×) plus the repository methods
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ status: "minted", count: "5" }, { status: "in_transit", count: "3" }] })
        .mockResolvedValueOnce({ rows: [{ manufacturer_address: "0xmfg1", count: "4" }] });

      (analyticsRepo.getNFTHealth as jest.Mock).mockResolvedValueOnce({
        expiring_30d: 2, expiring_7d: 1, expired: 0, total: 8,
      });
      (analyticsRepo.getSupplyChainFunnel as jest.Mock).mockResolvedValueOnce({
        minted: 5, at_distributor: 3, at_pharmacy: 1, dispensed: 2, total: 11,
      });

      const result = await analyticsService.getNFTStats();

      expect(result.total).toBe(8);
      expect(result.health).toEqual({ expiring_30d: 2, expiring_7d: 1, expired: 0, total: 8 });
      expect(result.funnel).toEqual({ minted: 5, at_distributor: 3, at_pharmacy: 1, dispensed: 2, total: 11 });
      expect(analyticsRepo.getNFTHealth).toHaveBeenCalled();
      expect(analyticsRepo.getSupplyChainFunnel).toHaveBeenCalled();
    });

    it("should throw when pool query fails", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("DB error"));

      await expect(analyticsService.getNFTStats()).rejects.toThrow("DB error");
    });
  });

  // ─── getAlertsSummary ───────────────────────────────────────────────────────

  describe("getAlertsSummary", () => {
    it("should return alerts summary with expiring, sensor, and quality alerts", async () => {
      const mockExpiring = [{ id: 1, name: "Drug-A", expiry_date: "2026-05-01" }];
      const mockSensor = [{ nft_id: 1, severity: "warning", temperature: 9 }];
      const mockQuality = [{ id: 1, severity: "critical", alert_type: "temperature" }];

      (analyticsRepo.getExpiringNFTs as jest.Mock).mockResolvedValueOnce(mockExpiring);
      (analyticsRepo.getSensorAlerts as jest.Mock).mockResolvedValueOnce(mockSensor);
      (analyticsRepo.getUnresolvedQualityAlerts as jest.Mock).mockResolvedValueOnce(mockQuality);

      const result = await analyticsService.getAlertsSummary(30);

      expect(result.expiring).toEqual(mockExpiring);
      expect(result.sensorAlerts).toEqual(mockSensor);
      expect(result.qualityAlerts).toEqual(mockQuality);
      expect(analyticsRepo.getExpiringNFTs).toHaveBeenCalledWith(30);
      expect(analyticsRepo.getSensorAlerts).toHaveBeenCalledWith(60);
    });

    it("should default to 30 days when called without argument", async () => {
      (analyticsRepo.getExpiringNFTs as jest.Mock).mockResolvedValueOnce([]);
      (analyticsRepo.getSensorAlerts as jest.Mock).mockResolvedValueOnce([]);
      (analyticsRepo.getUnresolvedQualityAlerts as jest.Mock).mockResolvedValueOnce([]);

      await analyticsService.getAlertsSummary();

      expect(analyticsRepo.getExpiringNFTs).toHaveBeenCalledWith(30);
    });

    it("should throw when repository throws", async () => {
      (analyticsRepo.getExpiringNFTs as jest.Mock).mockRejectedValueOnce(new Error("Repo error"));

      await expect(analyticsService.getAlertsSummary(30)).rejects.toThrow("Repo error");
    });
  });

  // ─── getTrends ─────────────────────────────────────────────────────────────

  describe("getTrends", () => {
    it("should return NFT creation and dispensing trends for 30d period", async () => {
      const mockCreation = [{ date: "2026-04-01", count: 3, cumulative: 3 }];
      const mockDispensing = [{ date: "2026-04-01", count: 1, cumulative: 10 }];

      (analyticsRepo.getNFTCreationTrend as jest.Mock).mockResolvedValueOnce(mockCreation);
      (analyticsRepo.getDispensingTrend as jest.Mock).mockResolvedValueOnce(mockDispensing);

      const result = await analyticsService.getTrends("30d");

      expect(result.nftCreation).toEqual(mockCreation);
      expect(result.dispensing).toEqual(mockDispensing);
      expect(analyticsRepo.getNFTCreationTrend).toHaveBeenCalledWith(30);
      expect(analyticsRepo.getDispensingTrend).toHaveBeenCalledWith(30);
    });

    it("should use 7 days for 7d period", async () => {
      (analyticsRepo.getNFTCreationTrend as jest.Mock).mockResolvedValueOnce([]);
      (analyticsRepo.getDispensingTrend as jest.Mock).mockResolvedValueOnce([]);

      await analyticsService.getTrends("7d");

      expect(analyticsRepo.getNFTCreationTrend).toHaveBeenCalledWith(7);
    });

    it("should use 90 days for 90d period", async () => {
      (analyticsRepo.getNFTCreationTrend as jest.Mock).mockResolvedValueOnce([]);
      (analyticsRepo.getDispensingTrend as jest.Mock).mockResolvedValueOnce([]);

      await analyticsService.getTrends("90d");

      expect(analyticsRepo.getNFTCreationTrend).toHaveBeenCalledWith(90);
    });

    it("should throw when repository throws", async () => {
      (analyticsRepo.getNFTCreationTrend as jest.Mock).mockRejectedValueOnce(new Error("Trend error"));

      await expect(analyticsService.getTrends("30d")).rejects.toThrow("Trend error");
    });
  });

  // ─── getActivityHeatmap ────────────────────────────────────────────────────

  describe("getActivityHeatmap", () => {
    it("should return activity heatmap from repository", async () => {
      const mockHeatmap = { heatmap: { 0: { 8: 4 }, 4: { 17: 20 } }, maxCount: 20 };

      (analyticsRepo.getActivityHeatmap as jest.Mock).mockResolvedValueOnce(mockHeatmap);

      const result = await analyticsService.getActivityHeatmap(30);

      expect(result).toEqual(mockHeatmap);
      expect(analyticsRepo.getActivityHeatmap).toHaveBeenCalledWith(30);
    });

    it("should throw when repository throws", async () => {
      (analyticsRepo.getActivityHeatmap as jest.Mock).mockRejectedValueOnce(new Error("Heatmap error"));

      await expect(analyticsService.getActivityHeatmap(30)).rejects.toThrow("Heatmap error");
    });
  });

  // ─── getSupplyChainFunnel ──────────────────────────────────────────────────

  describe("getSupplyChainFunnel", () => {
    it("should return supply chain funnel from repository", async () => {
      const mockFunnel = { minted: 5, at_distributor: 3, at_pharmacy: 1, dispensed: 2, total: 11 };

      (analyticsRepo.getSupplyChainFunnel as jest.Mock).mockResolvedValueOnce(mockFunnel);

      const result = await analyticsService.getSupplyChainFunnel();

      expect(result).toEqual(mockFunnel);
      expect(analyticsRepo.getSupplyChainFunnel).toHaveBeenCalled();
    });

    it("should throw when repository throws", async () => {
      (analyticsRepo.getSupplyChainFunnel as jest.Mock).mockRejectedValueOnce(new Error("Funnel error"));

      await expect(analyticsService.getSupplyChainFunnel()).rejects.toThrow("Funnel error");
    });
  });
});
