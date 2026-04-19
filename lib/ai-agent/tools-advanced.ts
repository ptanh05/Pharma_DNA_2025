/**
 * Advanced AI Agent Tools
 * Các tools nâng cao cho AI Agent: prediction, fraud detection, optimization
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { pool } from "@/lib/db";
import { getTokenProperties, getRole, Role, isProductExpired } from "@/lib/blockchain/contract";
import { logger } from "@/lib/utils/logger";

/**
 * Tool: Predict Quality
 * Dự đoán chất lượng sản phẩm dựa trên sensor data và lịch sử
 */
export const predictQualityTool = new DynamicStructuredTool({
  name: "predict_quality",
  description: "Dự đoán chất lượng sản phẩm dựa trên sensor data, lịch sử vận chuyển và các yếu tố khác",
  schema: z.object({
    nftId: z.number().describe("NFT ID trong database"),
    sensorData: z.any().optional().describe("Dữ liệu sensor (temperature, humidity, GPS)"),
    includeHistory: z.boolean().optional().describe("Bao gồm lịch sử vận chuyển"),
  }),
  func: async ({ nftId, sensorData, includeHistory = true }) => {
    try {
      // Get NFT data
      const nftResult = await pool.query("SELECT * FROM nfts WHERE id = $1", [nftId]);
      if (nftResult.rows.length === 0) {
        return JSON.stringify({ success: false, error: "NFT not found" });
      }

      const nft = nftResult.rows[0];

      // Get blockchain data
      let blockchainData = null;
      try {
        if (nft.token_id) {
          blockchainData = await getTokenProperties(nft.token_id);
          const expired = await isProductExpired(nft.token_id);
          if (blockchainData) {
            blockchainData.expired = expired;
          }
        }
      } catch (error) {
        logger.error("AI_TOOLS_ADVANCED", "Error fetching blockchain data", error as Error);
      }

      // Get milestones
      const milestonesResult = await pool.query(
        "SELECT * FROM milestones WHERE nft_id = $1 ORDER BY timestamp ASC",
        [nftId]
      );
      const milestones = milestonesResult.rows;

      // Get quality alerts
      const alertsResult = await pool.query(
        "SELECT * FROM quality_alerts WHERE nft_id = $1 ORDER BY created_at DESC",
        [nftId]
      );
      const alerts = alertsResult.rows;

      // Analyze sensor data if provided
      let sensorAnalysis = null;
      if (sensorData) {
        const data = typeof sensorData === "string" ? JSON.parse(sensorData) : sensorData;
        const temps = data.temperature || [];
        const humidities = data.humidity || [];

        if (temps.length > 0 || humidities.length > 0) {
          const avgTemp = temps.length > 0 
            ? temps.reduce((a: number, b: number) => a + b, 0) / temps.length 
            : null;
          const avgHumidity = humidities.length > 0
            ? humidities.reduce((a: number, b: number) => a + b, 0) / humidities.length
            : null;

          sensorAnalysis = {
            avgTemperature: avgTemp,
            avgHumidity: avgHumidity,
            temperatureRange: temps.length > 0 ? { min: Math.min(...temps), max: Math.max(...temps) } : null,
            humidityRange: humidities.length > 0 ? { min: Math.min(...humidities), max: Math.max(...humidities) } : null,
          };
        }
      }

      // Calculate quality score
      let qualityScore = 1.0;
      const factors: string[] = [];

      // Check expiry
      if (blockchainData?.expired) {
        qualityScore -= 0.5;
        factors.push("Product expired");
      } else if (blockchainData?.expiry_date) {
        const expiryDate = new Date(blockchainData.expiry_date * 1000);
        const daysUntilExpiry = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry < 30) {
          qualityScore -= 0.2;
          factors.push("Expiring soon");
        }
      }

      // Check alerts
      if (alerts.length > 0) {
        const criticalAlerts = alerts.filter((a: any) => a.severity === "critical");
        const warningAlerts = alerts.filter((a: any) => a.severity === "warning");
        qualityScore -= criticalAlerts.length * 0.3;
        qualityScore -= warningAlerts.length * 0.1;
        if (criticalAlerts.length > 0) {
          factors.push(`${criticalAlerts.length} critical alerts`);
        }
        if (warningAlerts.length > 0) {
          factors.push(`${warningAlerts.length} warnings`);
        }
      }

      // Check sensor data
      if (sensorAnalysis) {
        if (sensorAnalysis.avgTemperature !== null) {
          if (sensorAnalysis.avgTemperature > 8 || sensorAnalysis.avgTemperature < 2) {
            qualityScore -= 0.2;
            factors.push("Temperature out of range");
          }
        }
        if (sensorAnalysis.avgHumidity !== null) {
          if (sensorAnalysis.avgHumidity > 60 || sensorAnalysis.avgHumidity < 30) {
            qualityScore -= 0.15;
            factors.push("Humidity out of range");
          }
        }
      }

      // Check milestones (delivery time)
      if (milestones.length > 0) {
        const firstMilestone = milestones[0];
        const lastMilestone = milestones[milestones.length - 1];
        const deliveryTime = new Date(lastMilestone.timestamp).getTime() - new Date(firstMilestone.timestamp).getTime();
        const daysInTransit = deliveryTime / (1000 * 60 * 60 * 24);
        
        if (daysInTransit > 30) {
          qualityScore -= 0.1;
          factors.push("Long transit time");
        }
      }

      qualityScore = Math.max(0, Math.min(1, qualityScore));

      // Predict quality level
      let qualityLevel = "excellent";
      if (qualityScore < 0.5) {
        qualityLevel = "poor";
      } else if (qualityScore < 0.7) {
        qualityLevel = "fair";
      } else if (qualityScore < 0.9) {
        qualityLevel = "good";
      }

      return JSON.stringify({
        success: true,
        prediction: {
          qualityScore: Math.round(qualityScore * 100) / 100,
          qualityLevel,
          factors,
          recommendations: qualityScore < 0.7 
            ? ["Kiểm tra kỹ sản phẩm trước khi phân phối", "Xem xét recall nếu cần"]
            : qualityScore < 0.9
            ? ["Theo dõi chặt chẽ", "Kiểm tra định kỳ"]
            : ["Sản phẩm chất lượng tốt", "Có thể phân phối bình thường"],
          sensorAnalysis,
          alertsCount: alerts.length,
          milestonesCount: milestones.length,
        },
      });
    } catch (error: any) {
      logger.error("AI_TOOLS_ADVANCED", "Predict quality error", error as Error);
      return JSON.stringify({
        success: false,
        error: error.message || "Unknown error occurred",
      });
    }
  },
});

/**
 * Tool: Detect Fraud
 * Phát hiện gian lận dựa trên patterns và anomalies
 */
export const detectFraudTool = new DynamicStructuredTool({
  name: "detect_fraud",
  description: "Phát hiện gian lận và bất thường trong chuỗi cung ứng",
  schema: z.object({
    nftId: z.number().optional().describe("NFT ID cụ thể (optional, nếu không có sẽ scan tất cả)"),
    checkTypes: z.array(z.enum(["transfer", "milestone", "ownership", "timing", "sensor"])).optional()
      .describe("Các loại kiểm tra cần thực hiện"),
  }),
  func: async ({ nftId, checkTypes = ["transfer", "milestone", "ownership", "timing", "sensor"] }) => {
    try {
      const fraudIndicators: any[] = [];

      // Build query
      let query = "SELECT * FROM nfts WHERE 1=1";
      const params: any[] = [];
      if (nftId) {
        query += " AND id = $1";
        params.push(nftId);
      }
      query += " ORDER BY created_at DESC LIMIT 100";

      const nftsResult = await pool.query(query, params);
      const nfts = nftsResult.rows;

      for (const nft of nfts) {
        const indicators: any[] = [];

        // Check ownership transfers
        if (checkTypes.includes("transfer") || checkTypes.includes("ownership")) {
          try {
            if (nft.token_id) {
              const properties = await getTokenProperties(nft.token_id);
              if (properties) {
                // Check for rapid ownership changes
                const historyResult = await pool.query(
                  "SELECT COUNT(*) as count FROM milestones WHERE nft_id = $1 AND type LIKE '%transfer%'",
                  [nft.id]
                );
                const transferCount = parseInt(historyResult.rows[0]?.count || "0");
                
                if (transferCount > 5) {
                  indicators.push({
                    type: "rapid_transfers",
                    severity: "medium",
                    message: `NFT #${nft.id} có ${transferCount} lần chuyển quyền sở hữu (bất thường)`,
                  });
                }

                // Check for transfers to unauthorized addresses
                const role = await getRole(properties.owner);
                if (role === Role.NONE && nft.status !== "minted") {
                  indicators.push({
                    type: "unauthorized_owner",
                    severity: "high",
                    message: `NFT #${nft.id} được sở hữu bởi address không có role`,
                  });
                }
              }
            }
          } catch (error) {
            logger.error("AI_TOOLS_ADVANCED", `Error checking ownership for NFT ${nft.id}`, error as Error);
          }
        }

        // Check milestones timing
        if (checkTypes.includes("milestone") || checkTypes.includes("timing")) {
          const milestonesResult = await pool.query(
            "SELECT * FROM milestones WHERE nft_id = $1 ORDER BY timestamp ASC",
            [nft.id]
          );
          const milestones = milestonesResult.rows;

          if (milestones.length > 0) {
            // Check for impossible timing (milestones out of order)
            for (let i = 1; i < milestones.length; i++) {
              const prev = new Date(milestones[i - 1].timestamp);
              const curr = new Date(milestones[i].timestamp);
              if (curr < prev) {
                indicators.push({
                  type: "timing_anomaly",
                  severity: "medium",
                  message: `NFT #${nft.id} có milestones không đúng thứ tự thời gian`,
                });
                break;
              }
            }

            // Check for suspiciously fast delivery
            if (milestones.length >= 2) {
              const first = new Date(milestones[0].timestamp);
              const last = new Date(milestones[milestones.length - 1].timestamp);
              const hours = (last.getTime() - first.getTime()) / (1000 * 60 * 60);
              
              if (hours < 1 && nft.status === "at_pharmacy") {
                indicators.push({
                  type: "suspiciously_fast_delivery",
                  severity: "high",
                  message: `NFT #${nft.id} được giao trong ${hours.toFixed(1)} giờ (bất thường)`,
                });
              }
            }
          }
        }

        // Check sensor data anomalies
        if (checkTypes.includes("sensor")) {
          const alertsResult = await pool.query(
            "SELECT * FROM quality_alerts WHERE nft_id = $1 AND severity = 'critical'",
            [nft.id]
          );
          const criticalAlerts = alertsResult.rows;

          if (criticalAlerts.length > 3) {
            indicators.push({
              type: "multiple_critical_alerts",
              severity: "high",
              message: `NFT #${nft.id} có ${criticalAlerts.length} cảnh báo nghiêm trọng`,
            });
          }
        }

        if (indicators.length > 0) {
          fraudIndicators.push({
            nftId: nft.id,
            nftName: nft.name,
            indicators,
            riskScore: indicators.reduce((sum, ind) => {
              return sum + (ind.severity === "high" ? 3 : ind.severity === "medium" ? 2 : 1);
            }, 0),
          });
        }
      }

      // Sort by risk score
      fraudIndicators.sort((a, b) => b.riskScore - a.riskScore);

      return JSON.stringify({
        success: true,
        fraudDetection: {
          totalChecked: nfts.length,
          fraudCount: fraudIndicators.length,
          fraudIndicators: fraudIndicators.slice(0, 20), // Top 20
          summary: {
            highRisk: fraudIndicators.filter(f => f.riskScore >= 5).length,
            mediumRisk: fraudIndicators.filter(f => f.riskScore >= 3 && f.riskScore < 5).length,
            lowRisk: fraudIndicators.filter(f => f.riskScore < 3).length,
          },
        },
      });
    } catch (error: any) {
      logger.error("AI_TOOLS_ADVANCED", "Detect fraud error", error as Error);
      return JSON.stringify({
        success: false,
        error: error.message || "Unknown error occurred",
      });
    }
  },
});

/**
 * Tool: Optimize Route
 * Tối ưu hóa route vận chuyển dựa trên vị trí và constraints
 */
export const optimizeRouteTool = new DynamicStructuredTool({
  name: "optimize_route",
  description: "Tối ưu hóa route vận chuyển cho nhiều NFT/điểm đến",
  schema: z.object({
    nftIds: z.array(z.number()).describe("Danh sách NFT IDs cần vận chuyển"),
    destinations: z.array(z.object({
      address: z.string(),
      location: z.string().optional(),
      priority: z.number().optional(),
    })).describe("Danh sách điểm đến"),
    constraints: z.object({
      maxDistance: z.number().optional(),
      maxTime: z.number().optional(),
      temperatureSensitive: z.boolean().optional(),
    }).optional(),
  }),
  func: async ({ nftIds, destinations, constraints }) => {
    try {
      // Get NFT data
      const nftsResult = await pool.query(
        "SELECT * FROM nfts WHERE id = ANY($1::int[])",
        [nftIds]
      );
      const nfts = nftsResult.rows;

      if (nfts.length === 0) {
        return JSON.stringify({ success: false, error: "No NFTs found" });
      }

      // Get milestones for each NFT to determine current location
      const nftLocations: Record<number, string> = {};
      for (const nft of nfts) {
        const milestonesResult = await pool.query(
          "SELECT * FROM milestones WHERE nft_id = $1 ORDER BY timestamp DESC LIMIT 1",
          [nft.id]
        );
        if (milestonesResult.rows.length > 0) {
          nftLocations[nft.id] = milestonesResult.rows[0].location || "Unknown";
        }
      }

      // Simple optimization: sort by priority and distance (simplified)
      const optimizedRoute: any[] = [];
      
      // Group NFTs by destination
      const destinationGroups: Record<string, number[]> = {};
      destinations.forEach((dest, idx) => {
        if (!destinationGroups[dest.address]) {
          destinationGroups[dest.address] = [];
        }
        // Assign NFTs to destinations (round-robin for simplicity)
        if (idx < nftIds.length) {
          destinationGroups[dest.address].push(nftIds[idx]);
        }
      });

      // Build route
      let totalDistance = 0;
      let totalTime = 0;
      const routeSteps: any[] = [];

      for (const [address, assignedNfts] of Object.entries(destinationGroups)) {
        const dest = destinations.find(d => d.address === address);
        if (!dest) continue;

        const step = {
          destination: address,
          location: dest.location || "Unknown",
          nftIds: assignedNfts,
          priority: dest.priority || 1,
          estimatedDistance: Math.random() * 100, // Simplified
          estimatedTime: Math.random() * 2, // Simplified (hours)
        };

        routeSteps.push(step);
        totalDistance += step.estimatedDistance;
        totalTime += step.estimatedTime;
      }

      // Sort by priority
      routeSteps.sort((a, b) => (b.priority || 1) - (a.priority || 1));

      // Check constraints
      const warnings: string[] = [];
      if (constraints?.maxDistance && totalDistance > constraints.maxDistance) {
        warnings.push(`Total distance ${totalDistance.toFixed(2)}km exceeds limit ${constraints.maxDistance}km`);
      }
      if (constraints?.maxTime && totalTime > constraints.maxTime) {
        warnings.push(`Total time ${totalTime.toFixed(2)}h exceeds limit ${constraints.maxTime}h`);
      }

      return JSON.stringify({
        success: true,
        optimization: {
          route: routeSteps,
          summary: {
            totalNfts: nfts.length,
            totalDestinations: destinations.length,
            totalDistance: Math.round(totalDistance * 100) / 100,
            totalTime: Math.round(totalTime * 100) / 100,
            warnings,
          },
          recommendations: [
            "Sử dụng xe lạnh cho temperature-sensitive products",
            "Ưu tiên giao hàng theo thứ tự priority",
            "Theo dõi GPS real-time trong quá trình vận chuyển",
          ],
        },
      });
    } catch (error: any) {
      logger.error("AI_TOOLS_ADVANCED", "Optimize route error", error as Error);
      return JSON.stringify({
        success: false,
        error: error.message || "Unknown error occurred",
      });
    }
  },
});
