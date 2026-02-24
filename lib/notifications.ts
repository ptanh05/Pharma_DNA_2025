/**
 * Real-time Notifications Service
 * Socket.io integration cho thông báo real-time
 */

import { Server as SocketIOServer, Socket }from 'socket.io';
import type { Server as HTTPServer }from 'http';
import type { NextApiRequest }from 'next';
import { logInfo, logError, logEvent }from '@/lib/logger';
import { v4 as uuidv4 }from 'uuid';

/**
 * Notification types
 */
export type NotificationType = 
  | 'NFT_MINTED'
  | 'NFT_TRANSFERRED'
  | 'RECEIPT_CONFIRMED'
  | 'PRODUCT_DISPENSED'
  | 'CONTRACT_UPGRADED'
  | 'USER_JOINED'
  | 'STATUS_UPDATED';

/**
 * Notification payload
 */
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  data?: Record<string, any>;
  read: boolean;
}

/**
 * Notification Manager
 */
class NotificationManager {
  private io: SocketIOServer | null = null;
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set<socketId>
  private notifications: Map<string, Notification[]> = new Map(); // userId -> notifications

  /**
   * Initialize Socket.io
   */
  initialize(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || '*',
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // Middleware để authenticate
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('No authentication token'));
      }
      
      // Verify token (simplified)
      try {
        const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        socket.data.userId = decoded.userId;
        socket.data.role = decoded.role;
        next();
      }catch (error) {
        next(new Error('Invalid token'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket: Socket) => {
      const userId = socket.data.userId;
      
      logInfo('Socket.io client connected', {
        socketId: socket.id,
        userId,
        role: socket.data.role,
      });

      // Register user socket
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);

      // Send pending notifications
      this.sendPendingNotifications(userId, socket);

      // Disconnect handler
      socket.on('disconnect', () => {
        this.userSockets.get(userId)?.delete(socket.id);
        
        logInfo('Socket.io client disconnected', {
          socketId: socket.id,
          userId,
        });
      });

      // Mark notification as read
      socket.on('notification:read', (notificationId: string) => {
        this.markAsRead(userId, notificationId);
        socket.emit('notification:read:ack', { notificationId });
      });

      // Request notification history
      socket.on('notifications:history', (limit: number = 20) => {
        const notifications = this.getNotifications(userId, limit);
        socket.emit('notifications:history', notifications);
      });
    });

    logInfo('Socket.io initialized');
  }

  /**
   * Send notification to user
   */
  sendNotification(userId: string, notification: Omit<Notification, 'id'>) {
    const id = uuidv4();
    const fullNotification: Notification = {
      ...notification,
      id,
    };

    // Store notification
    if (!this.notifications.has(userId)) {
      this.notifications.set(userId, []);
    }
    this.notifications.get(userId)!.unshift(fullNotification);

    // Keep only last 100 notifications
    const userNotifications = this.notifications.get(userId)!;
    if (userNotifications.length > 100) {
      userNotifications.pop();
    }

    // Send to all user's sockets
    const sockets = this.userSockets.get(userId);
    if (sockets && sockets.size > 0) {
      sockets.forEach(socketId => {
        this.io?.to(socketId).emit('notification', fullNotification);
      });
    }

    logEvent({
      requestId: uuidv4(),
      event: `NOTIFICATION_SENT_${notification.type}`,
      userId,
      details: {
        notificationType: notification.type,
        message: notification.message,
      },
      severity: 'info',
    });

    return fullNotification;
  }

  /**
   * Broadcast to specific role
   */
  broadcastToRole(role: string, notification: Omit<Notification, 'id'>) {
    // In production, would need to track user roles
    logInfo('Broadcasting to role', {
      role,
      type: notification.type,
      message: notification.message,
    });
  }

  /**
   * Send pending notifications
   */
  private sendPendingNotifications(userId: string, socket: Socket) {
    const notifications = this.getNotifications(userId);
    if (notifications.length > 0) {
      socket.emit('notifications:pending', notifications);
    }
  }

  /**
   * Get notifications for user
   */
  private getNotifications(userId: string, limit: number = 20): Notification[] {
    const notifications = this.notifications.get(userId) || [];
    return notifications.slice(0, limit);
  }

  /**
   * Mark notification as read
   */
  private markAsRead(userId: string, notificationId: string) {
    const notifications = this.notifications.get(userId) || [];
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
    }
  }

  /**
   * Get IO instance
   */
  getIO(): SocketIOServer | null {
    return this.io;
  }
}

// Singleton instance
let notificationManager: NotificationManager | null = null;

/**
 * Get or create notification manager
 */
export function getNotificationManager(): NotificationManager {
  if (!notificationManager) {
    notificationManager = new NotificationManager();
  }
  return notificationManager;
}

/**
 * Notification factory
 */
export const notificationFactory = {
  nftMinted: (data: { batchNumber: string; productName: string }): Omit<Notification, 'id'> => ({
    type: 'NFT_MINTED',
    title: 'NFT Đã Được Tạo',
    message: `Sản phẩm "${data.productName}" (Batch: ${data.batchNumber}) đã được mint thành công`,
    timestamp: new Date().toISOString(),
    data,
    read: false,
  }),

  nftTransferred: (data: { batchNumber: string; to: string; role: string }): Omit<Notification, 'id'> => ({
    type: 'NFT_TRANSFERRED',
    title: 'NFT Đã Được Chuyển',
    message: `Sản phẩm "${data.batchNumber}" đã được chuyển cho ${data.role}`,
    timestamp: new Date().toISOString(),
    data,
    read: false,
  }),

  receiptConfirmed: (data: { batchNumber: string; quantity: number }): Omit<Notification, 'id'> => ({
    type: 'RECEIPT_CONFIRMED',
    title: 'Receipt Đã Được Xác Nhận',
    message: `${data.quantity}đơn vị của sản phẩm "${data.batchNumber}" đã được xác nhận nhận hàng`,
    timestamp: new Date().toISOString(),
    data,
    read: false,
  }),

  productDispensed: (data: { batchNumber: string; quantity: number; customerId: string }): Omit<Notification, 'id'> => ({
    type: 'PRODUCT_DISPENSED',
    title: 'Sản Phẩm Đã Được Phát Hành',
    message: `${data.quantity} đơn vị của sản phẩm "${data.batchNumber}" đã được phát hành cho khách hàng`,
    timestamp: new Date().toISOString(),
    data,
    read: false,
  }),

  contractUpgraded: (data: { fromVersion: string; toVersion: string }): Omit<Notification, 'id'> => ({
    type: 'CONTRACT_UPGRADED',
    title: 'Smart Contract Đã Được Nâng Cấp',
    message: `Contract đã được nâng cấp từ v${data.fromVersion} lên v${data.toVersion}`,
    timestamp: new Date().toISOString(),
    data,
    read: false,
  }),
};
