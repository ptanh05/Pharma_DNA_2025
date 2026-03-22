/**
 * Notification Service
 * lib/services/notification.service.ts
 */

import { pool } from "@/lib/db";
import { ensureTableExists, TABLE_DEFINITIONS } from "@/lib/db/table-init";
import { logger }from "@/lib/utils/logger";

export class NotificationService {
  /**
   * Create notification
   */
  async createNotification(data: {
    userId?: string;
    recipientAddress?: string;
    type: string;
    title: string;
    message: string;
    priority?: string;
  }) {
    try {
      // Ensure table exists
      await ensureTableExists('notifications', TABLE_DEFINITIONS.notifications);

      const recipient = data.recipientAddress || data.userId || '';
      const result = await pool.query(
        `INSERT INTO notifications (recipient_address, user_id, type, title, message, priority, is_read, read)
         VALUES ($1, $2, $3, $4, $5, $6, false, false)
         RETURNING *`,
        [recipient.toLowerCase(), recipient.toLowerCase(), data.type, data.title, data.message, data.priority || 'medium']
      );

      logger.info("notification", `Notification created for ${recipient}`);
      return result.rows[0];
    } catch (error) {
      logger.error("notification", "Failed to create notification", error);
      throw error;
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: string) {
    try {
      // Ensure table exists
      await ensureTableExists('notifications', TABLE_DEFINITIONS.notifications);

      const result = await pool.query(
        `SELECT * FROM notifications
         WHERE user_id = $1 OR recipient_address = $1
         ORDER BY created_at DESC LIMIT 50`,
        [userId.toLowerCase()]
      );

      return result.rows;
    } catch (error) {
      logger.error("notification", "Failed to get notifications", error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();
