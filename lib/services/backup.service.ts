/**
 * Backup Service
 * lib/services/backup.service.ts
 * Exports all critical system data as JSON for backup/restore
 */

import { pool } from "@/lib/db";
import { logger } from "@/lib/utils/logger";

export interface SystemBackup {
  version: string;
  timestamp: string;
  tables: {
    nfts: any[];
    users: any[];
    milestones: any[];
    transfer_requests: any[];
    transfer_requests_v2: any[];
    notifications: any[];
    quality_alerts: any[];
  };
  stats: {
    nftCount: number;
    userCount: number;
    milestoneCount: number;
    transferRequestCount: number;
    notificationCount: number;
    qualityAlertCount: number;
  };
}

export class BackupService {
  /**
   * Generate a full system backup as JSON
   */
  async generateBackup(): Promise<SystemBackup> {
    const timestamp = new Date().toISOString();

    const [nftsResult, usersResult, milestonesResult,
           trResult, tr2Result, notificationsResult,
           qualityAlertsResult] = await Promise.allSettled([
      pool.query("SELECT * FROM nfts ORDER BY id"),
      pool.query("SELECT * FROM users ORDER BY id"),
      pool.query("SELECT * FROM milestones ORDER BY id"),
      pool.query("SELECT * FROM transfer_requests ORDER BY id"),
      pool.query("SELECT * FROM transfer_requests_v2 ORDER BY id"),
      pool.query("SELECT * FROM notifications ORDER BY id"),
      pool.query("SELECT * FROM quality_alerts ORDER BY id"),
    ]);

    const nfts = this.getResultData(nftsResult, "nfts");
    const users = this.getResultData(usersResult, "users");
    const milestones = this.getResultData(milestonesResult, "milestones");
    const transfer_requests = this.getResultData(trResult, "transfer_requests");
    const transfer_requests_v2 = this.getResultData(tr2Result, "transfer_requests_v2");
    const notifications = this.getResultData(notificationsResult, "notifications");
    const quality_alerts = this.getResultData(qualityAlertsResult, "quality_alerts");

    const backup: SystemBackup = {
      version: "1.0.0",
      timestamp,
      tables: {
        nfts,
        users,
        milestones,
        transfer_requests,
        transfer_requests_v2,
        notifications,
        quality_alerts,
      },
      stats: {
        nftCount: nfts.length,
        userCount: users.length,
        milestoneCount: milestones.length,
        transferRequestCount: transfer_requests.length + transfer_requests_v2.length,
        notificationCount: notifications.length,
        qualityAlertCount: quality_alerts.length,
      },
    };

    logger.info("backup", `Generated backup with ${backup.stats.nftCount} NFTs, ${backup.stats.userCount} users`);
    return backup;
  }

  /**
   * Export NFTs to CSV format
   */
  async exportNFTsCSV(): Promise<string> {
    const result = await pool.query(`
      SELECT
        n.id, n.name, n.batch_number, n.status,
        n.manufacturer_address, n.distributor_address, n.pharmacy_address,
        n.token_id, n.object_id, n.transaction_hash,
        n.ipfs_hash, n.image_url, n.certificate_url,
        n.manufacture_date, n.expiry_date, n.created_at, n.updated_at
      FROM nfts n
      ORDER BY n.created_at DESC
    `);

    const headers = [
      "ID", "Name", "Batch Number", "Status",
      "Manufacturer", "Distributor", "Pharmacy",
      "Token ID", "Object ID", "Transaction Hash",
      "IPFS Hash", "Image URL", "Certificate URL",
      "Manufacture Date", "Expiry Date", "Created At", "Updated At"
    ];

    const rows = result.rows.map((row: any) => [
      row.id, row.name, row.batch_number, row.status,
      row.manufacturer_address, row.distributor_address, row.pharmacy_address,
      row.token_id, row.object_id, row.transaction_hash,
      row.ipfs_hash, row.image_url, row.certificate_url,
      row.manufacture_date, row.expiry_date, row.created_at, row.updated_at
    ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));

    return [headers.join(","), ...rows].join("\n");
  }

  private getResultData(result: PromiseSettledResult<any>, tableName: string): any[] {
    if (result.status === "rejected") {
      logger.warn("backup", `Table ${tableName} not available: ${result.reason}`);
      return [];
    }
    return result.value.rows;
  }
}

export const backupService = new BackupService();
