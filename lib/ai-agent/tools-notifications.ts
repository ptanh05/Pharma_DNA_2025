/**
 * AI Agent Notification Tools
 * lib/ai-agent/tools-notifications.ts
 *
 * Tools for broadcasting alerts via SMS, email, and push notifications.
 * Integrates with notification service for persistence + SSE delivery.
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { pool } from "@/lib/db";
import { logger } from "@/lib/utils/logger";

/**
 * Tool: Broadcast Expiry Alert
 * Gửi thông báo hàng loạt cho các NFT sắp hết hạn
 */
export const broadcastExpiryAlertTool = new DynamicStructuredTool({
  name: "broadcast_expiry_alert",
  description:
    "Gửi thông báo hàng loạt cho tất cả stakeholders khi có NFT sắp hết hạn. " +
    "Input: danh sách batch_numbers cần cảnh báo. " +
    "Tự động gửi notification đến manufacturer, distributor, và pharmacy liên quan.",
  schema: z.object({
    batchNumbers: z
      .array(z.string())
      .describe("Danh sách batch numbers cần cảnh báo"),
    severity: z
      .enum(["info", "warning", "critical"])
      .default("warning")
      .describe("Mức độ nghiêm trọng của cảnh báo"),
    customMessage: z.string().optional().describe("Tin nhắn tùy chỉnh thay thế mặc định"),
  }),
  func: async ({ batchNumbers, severity, customMessage }) => {
    try {
      const results: {
        sent: number;
        failed: number;
        recipients: { address: string; role: string; batch: string }[];
      } = { sent: 0, failed: 0, recipients: [] };

      for (const batchNumber of batchNumbers) {
        // Find NFTs by batch number
        const nftsResult = await pool.query(
          `SELECT id, name, expiry_date, manufacturer_address,
                  distributor_address, pharmacy_address
           FROM nfts
           WHERE batch_number = $1 AND status != 'deleted'`,
          [batchNumber]
        );

        for (const nft of nftsResult.rows) {
          const recipients = [
            { address: nft.manufacturer_address, role: "MANUFACTURER", batch: batchNumber },
            ...(nft.distributor_address
              ? [{ address: nft.distributor_address, role: "DISTRIBUTOR", batch: batchNumber }]
              : []),
            ...(nft.pharmacy_address
              ? [{ address: nft.pharmacy_address, role: "PHARMACY", batch: batchNumber }]
              : []),
          ];

          for (const rec of recipients) {
            if (!rec.address) continue;
            try {
              const title =
                severity === "critical"
                  ? "Cảnh báo HẾT HẠN"
                  : severity === "warning"
                  ? "Cảnh báo sắp hết hạn"
                  : "Thông báo";

              const message =
                customMessage ||
                `NFT "${nft.name || batchNumber}" (Batch: ${batchNumber}) ${
                  severity === "critical"
                    ? "đã hết hạn"
                    : "sắp hết hạn"
                }. Vui lòng kiểm tra và xử lý ngay.`;

              await pool.query(
                `INSERT INTO notifications
                   (recipient_address, user_id, type, title, message, priority, is_read, read, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, false, false, NOW())`,
                [
                  rec.address.toLowerCase(),
                  rec.address.toLowerCase(),
                  severity === "critical" ? "expiry_critical" : "expiry_warning",
                  `${title}: ${nft.name || batchNumber}`,
                  message,
                  severity === "critical" ? "high" : "medium",
                ]
              );

              results.sent++;
              results.recipients.push({
                address: rec.address,
                role: rec.role,
                batch: batchNumber,
              });
            } catch (notifyError) {
              logger.error("AI_TOOLS_NOTIFY", `Failed to notify ${rec.address}`, notifyError as Error);
              results.failed++;
            }
          }
        }
      }

      logger.info("AI_TOOLS_NOTIFY", "Expiry alert broadcast completed", {
        sent: results.sent,
        failed: results.failed,
        batches: batchNumbers,
      });

      return JSON.stringify({
        success: true,
        sent: results.sent,
        failed: results.failed,
        recipients: results.recipients,
        message: `Đã gửi ${results.sent} thông báo cho ${results.recipients.length} recipients.`,
      });
    } catch (error: any) {
      logger.error("AI_TOOLS_NOTIFY", "Broadcast expiry alert failed", error as Error);
      return JSON.stringify({ success: false, error: error.message });
    }
  },
});

/**
 * Tool: Send Stakeholder Alert
 * Gửi cảnh báo đến một stakeholder cụ thể
 */
export const sendStakeholderAlertTool = new DynamicStructuredTool({
  name: "send_stakeholder_alert",
  description:
    "Gửi thông báo tức thì đến một address cụ thể (manufacturer, distributor, pharmacy, hoặc admin).",
  schema: z.object({
    address: z.string().describe("Địa chỉ ví Sui của người nhận"),
    alertType: z.enum([
      "transfer_received",
      "transfer_sent",
      "quality_alert",
      "cold_chain_alert",
      "system_alert",
      "custom",
    ]).describe("Loại cảnh báo"),
    title: z.string().describe("Tiêu đề thông báo"),
    message: z.string().describe("Nội dung thông báo"),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
    includeAction: z.boolean().optional().describe("Có kèm action button hay không"),
  }),
  func: async ({ address, alertType, title, message, priority, includeAction }) => {
    try {
      const normalizedAddress = address.toLowerCase();

      await pool.query(
        `INSERT INTO notifications
           (recipient_address, user_id, type, title, message, priority, is_read, read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, false, false, NOW())`,
        [normalizedAddress, normalizedAddress, alertType, title, message, priority]
      );

      logger.info("AI_TOOLS_NOTIFY", "Stakeholder alert sent", {
        address: normalizedAddress,
        type: alertType,
        priority,
      });

      const actionHint =
        includeAction
          ? " Recipient có thể nhấn vào notification để thực hiện action."
          : "";

      return JSON.stringify({
        success: true,
        address: normalizedAddress,
        type: alertType,
        message: `Đã gửi thông báo "${title}" đến ${normalizedAddress}.${actionHint}`,
      });
    } catch (error: any) {
      logger.error("AI_TOOLS_NOTIFY", "Send stakeholder alert failed", error as Error);
      return JSON.stringify({ success: false, error: error.message });
    }
  },
});

/**
 * Tool: Monitor Cold Chain Threshold
 * Kiểm tra và cảnh báo vi phạm cold chain
 */
export const monitorColdChainTool = new DynamicStructuredTool({
  name: "monitor_cold_chain",
  description:
    "Kiểm tra dữ liệu cảm biến (nhiệt độ, độ ẩm) trong khoảng thời gian và gửi cảnh báo nếu vượt ngưỡng an toàn. " +
    "Ngưỡng cold chain dược phẩm: 2–8°C, độ ẩm 35–65%.",
  schema: z.object({
    minutesBack: z
      .number()
      .min(1)
      .max(1440)
      .default(60)
      .describe("Khoảng thời gian kiểm tra (phút)"),
    temperatureMin: z
      .number()
      .default(2)
      .describe("Ngưỡng nhiệt độ tối thiểu (°C)"),
    temperatureMax: z
      .number()
      .default(8)
      .describe("Ngưỡng nhiệt độ tối đa (°C)"),
    humidityMin: z
      .number()
      .default(35)
      .describe("Ngưỡng độ ẩm tối thiểu (%)"),
    humidityMax: z
      .number()
      .default(65)
      .describe("Ngưỡng độ ẩm tối đa (%)"),
    autoAlert: z.boolean().default(true).describe("Tự động gửi cảnh báo đến stakeholders liên quan"),
  }),
  func: async ({ minutesBack, temperatureMin, temperatureMax, humidityMin, humidityMax, autoAlert }) => {
    try {
      const violations = await pool.query(
        `
        SELECT
          sd.id,
          sd.nft_id,
          n.batch_number,
          n.name AS nft_name,
          sd.temperature,
          sd.humidity,
          sd.gps_location,
          sd.recorded_at,
          sd.distributor_address,
          CASE
            WHEN sd.temperature < $2 OR sd.temperature > $3 THEN 'critical'
            WHEN sd.humidity < $4 OR sd.humidity > $5 THEN 'critical'
            WHEN sd.temperature < ($2 + $3) / 2 - 3 OR sd.temperature > ($2 + $3) / 2 + 3 THEN 'warning'
            ELSE 'normal'
          END AS severity
        FROM sensor_data sd
        LEFT JOIN nfts n ON sd.nft_id = n.id
        WHERE sd.recorded_at >= NOW() - ($1 || ' minutes')::INTERVAL
          AND (
            sd.temperature < $2 OR sd.temperature > $3
            OR sd.humidity < $4 OR sd.humidity > $5
          )
        ORDER BY sd.recorded_at DESC
        LIMIT 20
        `,
        [minutesBack, temperatureMin, temperatureMax, humidityMin, humidityMax]
      );

      const rows = violations.rows;

      if (autoAlert && rows.length > 0) {
        for (const v of rows) {
          if (!v.distributor_address && !v.nft_id) continue;
          const nftRow = v.nft_id
            ? await pool
                .query("SELECT manufacturer_address, distributor_address, pharmacy_address FROM nfts WHERE id = $1", [v.nft_id])
                .then((r) => r.rows[0])
                .catch(() => null)
            : null;

          const recipients = [
            nftRow?.manufacturer_address,
            nftRow?.distributor_address,
            v.distributor_address,
            nftRow?.pharmacy_address,
          ].filter(Boolean);

          for (const addr of recipients) {
            await pool
              .query(
                `INSERT INTO notifications
                   (recipient_address, user_id, type, title, message, priority, is_read, read, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, false, false, NOW())
                 ON CONFLICT DO NOTHING`,
                [
                  (addr as string).toLowerCase(),
                  (addr as string).toLowerCase(),
                  "cold_chain_alert",
                  `Cold Chain Alert: ${v.nft_name || v.batch_number || v.nft_id}`,
                  `Phát hiện vi phạm ngưỡng cold chain. Nhiệt độ: ${v.temperature}°C, Độ ẩm: ${v.humidity}%. Vị trí: ${v.gps_location || "N/A"}. Thời gian: ${v.recorded_at}`,
                  v.severity === "critical" ? "high" : "medium",
                ]
              )
              .catch((e) => logger.error("AI_TOOLS_NOTIFY", "Failed to alert cold chain", e as Error));
          }
        }
      }

      logger.info("AI_TOOLS_NOTIFY", "Cold chain monitor scan complete", {
        violations: rows.length,
        window: `${minutesBack} minutes`,
      });

      return JSON.stringify({
        success: true,
        violations: rows.length,
        criticalCount: rows.filter((r) => r.severity === "critical").length,
        warningCount: rows.filter((r) => r.severity === "warning").length,
        violationsList: rows.map((r) => ({
          nftId: r.nft_id,
          batchNumber: r.batch_number,
          temperature: r.temperature,
          humidity: r.humidity,
          severity: r.severity,
          recordedAt: r.recorded_at,
        })),
        alertsSent: autoAlert ? rows.length : 0,
      });
    } catch (error: any) {
      logger.error("AI_TOOLS_NOTIFY", "Cold chain monitor failed", error as Error);
      return JSON.stringify({ success: false, error: error.message });
    }
  },
});

/**
 * Tool: Get Notification Summary
 * Lấy tổng hợp notification chưa đọc theo role
 */
export const getNotificationSummaryTool = new DynamicStructuredTool({
  name: "get_notification_summary",
  description:
    "Lấy tổng hợp số lượng notifications chưa đọc, phân loại theo priority và type cho tất cả stakeholders.",
  schema: z.object({}),
  func: async () => {
    try {
      const result = await pool.query(`
        SELECT
          u.address,
          u.role,
          COUNT(n.id) FILTER (WHERE n.is_read = false) AS unread_count,
          COUNT(n.id) FILTER (WHERE n.priority = 'high' AND n.is_read = false) AS urgent_count,
          COUNT(n.id) FILTER (WHERE n.type = 'expiry_warning') AS expiry_count,
          COUNT(n.id) FILTER (WHERE n.type = 'cold_chain_alert') AS cold_chain_count,
          COUNT(n.id) FILTER (WHERE n.type = 'transfer_received') AS transfer_count,
          MAX(n.created_at) AS last_notification
        FROM users u
        LEFT JOIN notifications n ON n.recipient_address = u.address
          AND n.created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY u.address, u.role
        ORDER BY urgent_count DESC, unread_count DESC
        LIMIT 50
      `);

      const totalUnread = result.rows.reduce(
        (sum, r) => sum + parseInt(String(r.unread_count || "0"), 10),
        0
      );
      const totalUrgent = result.rows.reduce(
        (sum, r) => sum + parseInt(String(r.urgent_count || "0"), 10),
        0
      );

      return JSON.stringify({
        success: true,
        summary: {
          totalUnread,
          totalUrgent,
          byRole: result.rows.map((r) => ({
            address: r.address,
            role: r.role,
            unread: parseInt(String(r.unread_count || "0"), 10),
            urgent: parseInt(String(r.urgent_count || "0"), 10),
            expiryAlerts: parseInt(String(r.expiry_count || "0"), 10),
            coldChainAlerts: parseInt(String(r.cold_chain_count || "0"), 10),
            transferAlerts: parseInt(String(r.transfer_count || "0"), 10),
            lastNotification: r.last_notification,
          })),
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("AI_TOOLS_NOTIFY", "Get notification summary failed", error as Error);
      return JSON.stringify({ success: false, error: error.message });
    }
  },
});
