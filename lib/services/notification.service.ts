/**
 * Notification Service
 * lib/services/notification.service.ts
 */

import { pool } from "@/lib/db";
import { logger }from "@/lib/utils/logger";

export class NotificationService {
  /**
   * Create notification
   */
  async createNotification(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
  }) {
    try {
      const result = await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, read)
         VALUES ($1, $2, $3, $4, false)
         RETURNING *`,
        [data.userId, data.type, data.title, data.message]
      );

      logger.info("notification", `Notification created for ${data.userId}`);
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
      const result = await pool.query(
        `SELECT * FROM notifications WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 50`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      logger.error("notification", "Failed to get notifications", error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();
