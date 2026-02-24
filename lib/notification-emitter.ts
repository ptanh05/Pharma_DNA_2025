/**
 * Notification Event Emitter
 * Gửi notifications từ các API endpoints
 */

import { getNotificationManager, notificationFactory }from '@/lib/notifications';

/**
 * Emit notification events
 */
export const notificationEmitter = {
  /**
   * NFT minted
   */
  async onNFTMinted(userId: string, data: { batchNumber: string; productName: string }) {
    const manager = getNotificationManager();
    const notification = notificationFactory.nftMinted(data);
    manager.sendNotification(userId, notification);
  },

  /**
   * NFT transferred
   */
  async onNFTTransferred(userId: string, data: { batchNumber: string; to: string; role: string }) {
    const manager = getNotificationManager();
    const notification = notificationFactory.nftTransferred(data);
    manager.sendNotification(userId, notification);
  },

  /**
   * Receipt confirmed
   */
  async onReceiptConfirmed(userId: string, data: { batchNumber: string; quantity: number }) {
    const manager = getNotificationManager();
    const notification = notificationFactory.receiptConfirmed(data);
    manager.sendNotification(userId, notification);
  },

  /**
   * Product dispensed
   */
  async onProductDispensed(
    userId: string,
    data: { batchNumber: string; quantity: number; customerId: string }
  ) {
    const manager = getNotificationManager();
    const notification = notificationFactory.productDispensed(data);
    manager.sendNotification(userId, notification);
  },

  /**
   * Contract upgraded
   */
  async onContractUpgraded(data: { fromVersion: string; toVersion: string }) {
    const manager = getNotificationManager();
    const notification = notificationFactory.contractUpgraded(data);
    manager.broadcastToRole('ADMIN', notification);
  },
};
