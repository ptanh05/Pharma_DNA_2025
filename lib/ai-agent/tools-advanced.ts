/**
 * Advanced AI Agent Tools
 * Các tools nâng cao: prediction, fraud detection, etc.
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { pool } from "@/lib/db";

/**
 * Tool: Predict Quality
 */
export const predictQualityTool = new DynamicStructuredTool({
  name: "predict_quality",
  description: "Dự đoán chất lượng thuốc khi đến tay người dùng dựa trên điều kiện vận chuyển",
  schema: z.object({
    nftId: z.number().describe("NFT ID"),
    currentConditions: z.any().optional().describe("Điều kiện hiện tại (temperature, humidity, etc.)"),
  }),
  func: async ({ nftId, currentConditions }) => {
    try {
      // Get NFT info
      const nftResult = await pool.query("SELECT * FROM nfts WHERE id = $1", [nftId]);
      if (nftResult.rows.length === 0) {
        return JSON.stringify({ success: false, error: "NFT not found" });
      }

      const nft = nftResult.rows[0];

      // Get sensor analysis if available
      const sensorResult = await pool.query(
        "SELECT * FROM sensor_analysis WHERE nft_id = $1 ORDER BY analyzed_at DESC LIMIT 1",
        [nftId]
      );

      // Get milestones
      const milestonesResult = await pool.query(
        "SELECT * FROM milestones WHERE nft_id = $1 ORDER BY timestamp ASC",
        [nftId]
      );

      // Simple prediction algorithm
      let qualityScore = 1.0;
      const factors: any[] = [];

      if (sensorResult.rows.length > 0) {
        const analysis = sensorResult.rows[0];
        qualityScore = parseFloat(analysis.quality_score || "1.0");

        if (analysis.temperature_analysis) {
          const temp = JSON.parse(analysis.temperature_analysis);
          if (temp.anomalies && temp.anomalies.length > 0) {
            qualityScore -= 0.1 * temp.anomalies.length;
            factors.push({
              factor: "Temperature anomalies",
              impact: -0.1 * temp.anomalies.length,
            });
          }
        }

        if (analysis.humidity_analysis) {
          const humidity = JSON.parse(analysis.humidity_analysis);
          if (humidity.anomalies && humidity.anomalies.length > 0) {
            qualityScore -= 0.05 * humidity.anomalies.length;
            factors.push({
              factor: "Humidity anomalies",
              impact: -0.05 * humidity.anomalies.length,
            });
          }
        }
      }

      // Check expiry date
      const expiryDate = new Date(nft.expiry_date);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry < 30) {
        qualityScore -= 0.1;
        factors.push({
          factor: "Expiring soon",
          impact: -0.1,
        });
      }

      // Check transit time
      if (milestonesResult.rows.length > 0) {
        const firstMilestone = milestonesResult.rows[0];
        const lastMilestone = milestonesResult.rows[milestonesResult.rows.length - 1];
        const transitDays =
          (new Date(lastMilestone.timestamp).getTime() -
            new Date(firstMilestone.timestamp).getTime()) /
          (1000 * 60 * 60 * 24);

        if (transitDays > 14) {
          qualityScore -= 0.05;
          factors.push({
            factor: "Long transit time",
            impact: -0.05,
          });
        }
      }

      qualityScore = Math.max(0, Math.min(1, qualityScore));

      const prediction = {
        nftId,
        predictedQuality: qualityScore,
        predictedQualityPercent: (qualityScore * 100).toFixed(1),
        riskLevel: qualityScore < 0.5 ? "high" : qualityScore < 0.7 ? "medium" : "low",
        factors,
        recommendation:
          qualityScore < 0.7
            ? "Nên kiểm tra kỹ trước khi sử dụng"
            : qualityScore < 0.9
            ? "Chất lượng có thể bị ảnh hưởng nhẹ"
            : "Chất lượng tốt, an toàn sử dụng",
      };

      return JSON.stringify({
        success: true,
        prediction,
      });
    } catch (error: any) {
      console.error("Predict quality error:", error);
      return JSON.stringify({
        success: false,
        error: error.message || "Unknown error occurred",
      });
    }
  },
});

/**
 * Tool: Detect Fraud
 */
export const detectFraudTool = new DynamicStructuredTool({
  name: "detect_fraud",
  description: "Phát hiện gian lận và bất thường trong hệ thống",
  schema: z.object({
    nftId: z.number().optional().describe("NFT ID để kiểm tra (optional)"),
    checkType: z.enum(["nft", "transfer", "all"]).optional().describe("Loại kiểm tra"),
  }),
  func: async ({ nftId, checkType = "all" }) => {
    try {
      const frauds: any[] = [];

      if (checkType === "nft" || checkType === "all") {
        if (nftId) {
          // Check specific NFT
          const nftResult = await pool.query("SELECT * FROM nfts WHERE id = $1", [nftId]);
          if (nftResult.rows.length > 0) {
            const nft = nftResult.rows[0];

            // Check for duplicate batch numbers
            const duplicateCheck = await pool.query(
              "SELECT COUNT(*) as count FROM nfts WHERE batch_number = $1 AND id != $2",
              [nft.batch_number, nftId]
            );

            if (parseInt(duplicateCheck.rows[0]?.count || "0") > 0) {
              frauds.push({
                type: "duplicate_batch_number",
                severity: "high",
                nftId,
                message: `Batch number ${nft.batch_number} đã tồn tại cho NFT khác`,
              });
            }

            // Check IPFS hash validity
            if (nft.ipfs_hash) {
              try {
                const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${nft.ipfs_hash}`;
                const response = await fetch(ipfsUrl, { method: "HEAD" });
                if (!response.ok) {
                  frauds.push({
                    type: "invalid_ipfs_hash",
                    severity: "medium",
                    nftId,
                    message: `IPFS hash ${nft.ipfs_hash} không hợp lệ hoặc đã bị xóa`,
                  });
                }
              } catch (error) {
                frauds.push({
                  type: "ipfs_check_failed",
                  severity: "warning",
                  nftId,
                  message: "Không thể kiểm tra IPFS hash",
                });
              }
            }
          }
        } else {
          // Check all NFTs for duplicates
          const duplicates = await pool.query(
            `SELECT batch_number, COUNT(*) as count
             FROM nfts
             GROUP BY batch_number
             HAVING COUNT(*) > 1`
          );

          for (const dup of duplicates.rows) {
            frauds.push({
              type: "duplicate_batch_number",
              severity: "high",
              message: `Batch number ${dup.batch_number} bị trùng lặp ${dup.count} lần`,
            });
          }
        }
      }

      if (checkType === "transfer" || checkType === "all") {
        // Check for suspicious transfers
        const suspiciousTransfers = await pool.query(
          `SELECT tr.*, n.name as nft_name
           FROM transfer_requests_v2 tr
           JOIN nfts n ON tr.nft_id = n.id
           WHERE tr.status = 'approved'
           AND tr.created_at < tr.updated_at - INTERVAL '1 minute'`
        );

        // Check for rapid transfers (same NFT transferred multiple times quickly)
        const rapidTransfers = await pool.query(
          `SELECT nft_id, COUNT(*) as count, MIN(created_at) as first, MAX(created_at) as last
           FROM transfer_requests_v2
           WHERE status = 'approved'
           GROUP BY nft_id
           HAVING COUNT(*) > 3
           AND EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) < 3600`
        );

        for (const rapid of rapidTransfers.rows) {
          frauds.push({
            type: "rapid_transfers",
            severity: "warning",
            nftId: rapid.nft_id,
            message: `NFT #${rapid.nft_id} được chuyển ${rapid.count} lần trong vòng 1 giờ`,
          });
        }
      }

      return JSON.stringify({
        success: true,
        fraudsFound: frauds.length,
        frauds,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Detect fraud error:", error);
      return JSON.stringify({
        success: false,
        error: error.message || "Unknown error occurred",
      });
    }
  },
});

/**
 * Tool: Optimize Route
 */
export const optimizeRouteTool = new DynamicStructuredTool({
  name: "optimize_route",
  description: "Tối ưu hóa route vận chuyển cho distributor",
  schema: z.object({
    distributorAddress: z.string().describe("Địa chỉ distributor"),
    nftIds: z.array(z.number()).optional().describe("Danh sách NFT IDs cần vận chuyển"),
  }),
  func: async ({ distributorAddress, nftIds }) => {
    try {
      // Get NFTs to deliver
      let query = `
        SELECT n.*, tr.pharmacy_address, tr.transfer_note
        FROM nfts n
        LEFT JOIN transfer_requests_v2 tr ON n.id = tr.nft_id
        WHERE n.distributor_address = $1
        AND n.status = 'in_transit'
      `;

      const params: any[] = [distributorAddress.toLowerCase()];
      if (nftIds && nftIds.length > 0) {
        query += ` AND n.id = ANY($2)`;
        params.push(nftIds);
      }

      const result = await pool.query(query, params);
      const nfts = result.rows;

      if (nfts.length === 0) {
        return JSON.stringify({
          success: true,
          message: "Không có NFT nào cần vận chuyển",
          route: [],
        });
      }

      // Simple route optimization (group by pharmacy)
      const routeByPharmacy: Record<string, any[]> = {};
      for (const nft of nfts) {
        const pharmacy = nft.pharmacy_address || "unknown";
        if (!routeByPharmacy[pharmacy]) {
          routeByPharmacy[pharmacy] = [];
        }
        routeByPharmacy[pharmacy].push(nft);
      }

      const optimizedRoute = Object.entries(routeByPharmacy).map(([pharmacy, nfts]) => ({
        pharmacy,
        nftCount: nfts.length,
        nftIds: nfts.map((n) => n.id),
        estimatedTime: `${nfts.length * 15} minutes`, // 15 min per NFT
      }));

      return JSON.stringify({
        success: true,
        totalNFTs: nfts.length,
        totalStops: optimizedRoute.length,
        route: optimizedRoute,
        recommendation: `Nên giao ${optimizedRoute.length} điểm, ước tính ${optimizedRoute.reduce((sum, r) => sum + parseInt(r.estimatedTime), 0)} phút`,
      });
    } catch (error: any) {
      console.error("Optimize route error:", error);
      return JSON.stringify({
        success: false,
        error: error.message || "Unknown error occurred",
      });
    }
  },
});

