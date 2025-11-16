/**
 * Smart Tools for AI Agent
 * Các tools thông minh: smart notifications, auto-recovery, intelligent monitoring
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { pool } from "@/lib/db";
import { getTokenProperties, isProductExpired, getRole, Role } from "@/lib/blockchain/contract";

/**
 * Tool: Smart Notifications
 * Gửi thông báo thông minh dựa trên context và priority
 */
export const smartNotificationsTool = new DynamicStructuredTool({
  name: "smart_notifications",
  description: "Gửi thông báo thông minh cho nhiều recipients dựa trên context và priority",
  schema: z.object({
    notifications: z.array(z.object({
      recipientAddress: z.string(),
      type: z.string(),
      title: z.string(),
      message: z.string(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      context: z.any().optional(),
    })),
  }),
  func: async ({ notifications }) => {
    try {
      const results: any[] = [];
      const errors: any[] = [];

      for (let i = 0; i < notifications.length; i++) {
        const notification = notifications[i];
        try {
          // Enhance message based on context
          let enhancedMessage = notification.message;
          if (notification.context) {
            if (notification.context.nftId) {
              const nftResult = await pool.query("SELECT * FROM nfts WHERE id = $1", [notification.context.nftId]);
              if (nftResult.rows.length > 0) {
                const nft = nftResult.rows[0];
                enhancedMessage += `\n\nNFT: ${nft.name} (ID: ${nft.id})`;
                if (nft.token_id) {
                  enhancedMessage += `\nToken ID: ${nft.token_id}`;
                }
              }
            }
          }

          // Determine priority if not specified
          let priority = notification.priority || "medium";
          if (notification.type.includes("critical") || notification.type.includes("urgent")) {
            priority = "urgent";
          } else if (notification.type.includes("warning")) {
            priority = "high";
          }

          // Insert notification
          await pool.query(
            `INSERT INTO notifications (recipient_address, type, title, message, priority, is_read, created_at)
             VALUES ($1, $2, $3, $4, $5, false, NOW())`,
            [
              notification.recipientAddress.toLowerCase(),
              notification.type,
              notification.title,
              enhancedMessage,
              priority,
            ]
          );

          results.push({
            index: i + 1,
            recipientAddress: notification.recipientAddress,
            priority,
            success: true,
          });
        } catch (error: any) {
          errors.push({
            index: i + 1,
            recipientAddress: notification.recipientAddress,
            error: error.message || "Unknown error",
          });
        }
      }

      return JSON.stringify({
        success: true,
        summary: {
          total: notifications.length,
          successful: results.length,
          failed: errors.length,
        },
        results,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error("Smart notifications error:", error);
      return JSON.stringify({ 
        success: false, 
        error: error.message || "Unknown error occurred",
      });
    }
  },
});

/**
 * Tool: Auto Recovery
 * Tự động phục hồi từ lỗi và xử lý các vấn đề
 */
export const autoRecoveryTool = new DynamicStructuredTool({
  name: "auto_recovery",
  description: "Tự động phục hồi từ lỗi và xử lý các vấn đề trong hệ thống",
  schema: z.object({
    recoveryType: z.enum(["stuck_nfts", "failed_transfers", "expired_products", "orphaned_data"]),
    autoFix: z.boolean().optional().describe("Tự động sửa lỗi nếu có thể"),
  }),
  func: async ({ recoveryType, autoFix = false }) => {
    try {
      const issues: any[] = [];
      const fixes: any[] = [];

      switch (recoveryType) {
        case "stuck_nfts": {
          // Find NFTs stuck in transit
          const stuckNFTs = await pool.query(`
            SELECT n.*, MAX(m.timestamp) as last_milestone
            FROM nfts n
            LEFT JOIN milestones m ON n.id = m.nft_id
            WHERE n.status = 'in_transit'
            GROUP BY n.id
            HAVING MAX(m.timestamp) < NOW() - INTERVAL '7 days' OR MAX(m.timestamp) IS NULL
            LIMIT 50
          `);

          for (const nft of stuckNFTs.rows) {
            issues.push({
              nftId: nft.id,
              nftName: nft.name,
              issue: "Stuck in transit for more than 7 days",
              lastMilestone: nft.last_milestone,
            });

            if (autoFix) {
              // Create a warning milestone
              await pool.query(
                `INSERT INTO milestones (nft_id, type, description, timestamp, actor_address)
                 VALUES ($1, $2, $3, NOW(), $4)`,
                [
                  nft.id,
                  "Warning",
                  "NFT stuck in transit - requires attention",
                  "0x0000000000000000000000000000000000000000", // System address
                ]
              );

              // Send notification
              if (nft.distributor_address) {
                await pool.query(
                  `INSERT INTO notifications (recipient_address, type, title, message, priority, is_read, created_at)
                   VALUES ($1, $2, $3, $4, $5, false, NOW())`,
                  [
                    nft.distributor_address.toLowerCase(),
                    "warning",
                    "NFT Stuck in Transit",
                    `NFT ${nft.name} (ID: ${nft.id}) has been in transit for more than 7 days. Please check status.`,
                    "high",
                  ]
                );
              }

              fixes.push({
                nftId: nft.id,
                action: "Created warning milestone and sent notification",
              });
            }
          }
          break;
        }

        case "failed_transfers": {
          // Find failed transfer requests
          const failedTransfers = await pool.query(`
            SELECT * FROM transfer_requests_v2
            WHERE status = 'failed'
            AND created_at > NOW() - INTERVAL '30 days'
            ORDER BY created_at DESC
            LIMIT 50
          `);

          for (const transfer of failedTransfers.rows) {
            issues.push({
              transferId: transfer.id,
              nftId: transfer.nft_id,
              issue: "Transfer request failed",
              createdAt: transfer.created_at,
            });

            if (autoFix) {
              // Reset status to pending for retry
              await pool.query(
                `UPDATE transfer_requests_v2 SET status = 'pending', updated_at = NOW() WHERE id = $1`,
                [transfer.id]
              );

              fixes.push({
                transferId: transfer.id,
                action: "Reset status to pending for retry",
              });
            }
          }
          break;
        }

        case "expired_products": {
          // Find expired products that haven't been marked
          const expiredNFTs = await pool.query(`
            SELECT n.*, n.token_id
            FROM nfts n
            WHERE n.token_id IS NOT NULL
            AND n.status != 'expired'
            LIMIT 100
          `);

          for (const nft of expiredNFTs.rows) {
            try {
              const expired = await isProductExpired(nft.token_id);
              if (expired) {
                issues.push({
                  nftId: nft.id,
                  tokenId: nft.token_id,
                  issue: "Product expired but not marked",
                });

                if (autoFix) {
                  // Update status
                  await pool.query(
                    `UPDATE nfts SET status = 'expired' WHERE id = $1`,
                    [nft.id]
                  );

                  // Send notification to owner
                  const properties = await getTokenProperties(nft.token_id);
                  if (properties?.owner) {
                    await pool.query(
                      `INSERT INTO notifications (recipient_address, type, title, message, priority, is_read, created_at)
                       VALUES ($1, $2, $3, $4, $5, false, NOW())`,
                      [
                        properties.owner.toLowerCase(),
                        "warning",
                        "Product Expired",
                        `Product ${nft.name} (Token ID: ${nft.token_id}) has expired.`,
                        "high",
                      ]
                    );
                  }

                  fixes.push({
                    nftId: nft.id,
                    tokenId: nft.token_id,
                    action: "Marked as expired and sent notification",
                  });
                }
              }
            } catch (error) {
              // Skip if can't check
              console.error(`Error checking expiry for NFT ${nft.id}:`, error);
            }
          }
          break;
        }

        case "orphaned_data": {
          // Find milestones without corresponding NFT
          const orphanedMilestones = await pool.query(`
            SELECT m.*
            FROM milestones m
            LEFT JOIN nfts n ON m.nft_id = n.id
            WHERE n.id IS NULL
            LIMIT 100
          `);

          for (const milestone of orphanedMilestones.rows) {
            issues.push({
              milestoneId: milestone.id,
              nftId: milestone.nft_id,
              issue: "Milestone without corresponding NFT",
            });

            if (autoFix) {
              // Delete orphaned milestone
              await pool.query(`DELETE FROM milestones WHERE id = $1`, [milestone.id]);
              fixes.push({
                milestoneId: milestone.id,
                action: "Deleted orphaned milestone",
              });
            }
          }
          break;
        }
      }

      return JSON.stringify({
        success: true,
        recoveryType,
        summary: {
          issuesFound: issues.length,
          fixesApplied: fixes.length,
        },
        issues: issues.slice(0, 20), // Limit output
        fixes: fixes.slice(0, 20),
      });
    } catch (error: any) {
      console.error("Auto recovery error:", error);
      return JSON.stringify({ 
        success: false, 
        error: error.message || "Unknown error occurred",
      });
    }
  },
});

/**
 * Tool: Intelligent Monitoring
 * Giám sát thông minh và phát hiện patterns
 */
export const intelligentMonitoringTool = new DynamicStructuredTool({
  name: "intelligent_monitoring",
  description: "Giám sát thông minh hệ thống và phát hiện patterns, anomalies",
  schema: z.object({
    monitorType: z.enum(["performance", "quality", "fraud", "compliance"]),
    timeRange: z.enum(["1h", "24h", "7d", "30d"]).optional(),
  }),
  func: async ({ monitorType, timeRange = "24h" }) => {
    try {
      let timeFilter = "";
      switch (timeRange) {
        case "1h":
          timeFilter = "WHERE created_at >= NOW() - INTERVAL '1 hour'";
          break;
        case "24h":
          timeFilter = "WHERE created_at >= NOW() - INTERVAL '24 hours'";
          break;
        case "7d":
          timeFilter = "WHERE created_at >= NOW() - INTERVAL '7 days'";
          break;
        case "30d":
          timeFilter = "WHERE created_at >= NOW() - INTERVAL '30 days'";
          break;
      }

      const insights: any = {
        monitorType,
        timeRange,
        timestamp: new Date().toISOString(),
      };

      switch (monitorType) {
        case "performance": {
          // Monitor system performance
          const nftStats = await pool.query(`
            SELECT 
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE status = 'CREATED') as created,
              COUNT(*) FILTER (WHERE status = 'in_transit') as in_transit,
              COUNT(*) FILTER (WHERE status = 'in_pharmacy') as in_pharmacy,
              COUNT(*) FILTER (WHERE status = 'expired') as expired
            FROM nfts ${timeFilter}
          `);

          const milestoneStats = await pool.query(`
            SELECT COUNT(*) as total FROM milestones ${timeFilter}
          `);

          const transferStats = await pool.query(`
            SELECT 
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE status = 'approved') as approved,
              COUNT(*) FILTER (WHERE status = 'pending') as pending,
              COUNT(*) FILTER (WHERE status = 'failed') as failed
            FROM transfer_requests_v2 ${timeFilter}
          `);

          insights.performance = {
            nfts: nftStats.rows[0],
            milestones: milestoneStats.rows[0],
            transfers: transferStats.rows[0],
          };
          break;
        }

        case "quality": {
          // Monitor quality issues
          const qualityAlerts = await pool.query(`
            SELECT 
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE severity = 'critical') as critical,
              COUNT(*) FILTER (WHERE severity = 'warning') as warning
            FROM quality_alerts ${timeFilter}
          `);

          insights.quality = {
            alerts: qualityAlerts.rows[0],
          };
          break;
        }

        case "fraud": {
          // Monitor fraud indicators
          const rapidTransfers = await pool.query(`
            SELECT n.id, COUNT(m.id) as transfer_count
            FROM nfts n
            JOIN milestones m ON n.id = m.nft_id
            WHERE m.type LIKE '%transfer%'
            ${timeFilter.replace("created_at", "m.timestamp")}
            GROUP BY n.id
            HAVING COUNT(m.id) > 5
          `);

          insights.fraud = {
            suspiciousNFTs: rapidTransfers.rows.length,
            details: rapidTransfers.rows.slice(0, 10),
          };
          break;
        }

        case "compliance": {
          // Monitor compliance
          const expiredCount = await pool.query(`
            SELECT COUNT(*) as count
            FROM nfts n
            WHERE n.status != 'expired'
            AND n.token_id IS NOT NULL
            ${timeFilter}
          `);

          let actuallyExpired = 0;
          // Check a sample
          const sample = await pool.query(`
            SELECT token_id FROM nfts 
            WHERE token_id IS NOT NULL 
            ${timeFilter}
            LIMIT 50
          `);

          for (const row of sample.rows) {
            try {
              if (await isProductExpired(row.token_id)) {
                actuallyExpired++;
              }
            } catch (error) {
              // Skip
            }
          }

          insights.compliance = {
            potentiallyExpired: expiredCount.rows[0].count,
            sampleChecked: sample.rows.length,
            actuallyExpiredInSample: actuallyExpired,
          };
          break;
        }
      }

      return JSON.stringify({
        success: true,
        insights,
      });
    } catch (error: any) {
      console.error("Intelligent monitoring error:", error);
      return JSON.stringify({ 
        success: false, 
        error: error.message || "Unknown error occurred",
      });
    }
  },
});

