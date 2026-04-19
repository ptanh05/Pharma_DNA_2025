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
   * Safely extract rows from a PromiseSettledResult
   */
  private getResultData(result: PromiseSettledResult<{ rows: any[] }>, tableName: string): any[] {
    if (result.status === "fulfilled") {
      return result.value.rows;
    }
    logger.error("backup", `Failed to query ${tableName}: ${result.reason?.message ?? result.reason}`);
    return [];
  }

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

  /**
   * Restore data from a backup JSON file
   * Uses INSERT ... ON CONFLICT DO UPDATE (upsert) to safely restore
   * without duplicating existing records
   */
  async restoreFromBackup(backup: SystemBackup): Promise<{
    restored: Record<string, number>;
    errors: string[];
  }> {
    const errors: string[] = [];
    const restored: Record<string, number> = {};

    const tables: Array<{
      name: string;
      rows: any[];
      upsertKey: string;
      columns: string[];
    }> = [
      {
        name: "users",
        rows: backup.tables.users,
        upsertKey: "address",
        columns: ["address", "role", "assigned_at", "updated_at", "created_at", "blockchain_synced", "blockchain_tx", "blockchain_error"],
      },
      {
        name: "nfts",
        rows: backup.tables.nfts,
        upsertKey: "id",
        columns: [
          "id", "name", "batch_number", "manufacture_date", "expiry_date",
          "description", "image_url", "certificate_url", "status",
          "ipfs_hash", "manufacturer_address", "distributor_address", "pharmacy_address",
          "token_id", "object_id", "transaction_digest", "transaction_hash",
          "quantity", "last_dispensed_at", "receipt_confirmed_at", "created_at", "updated_at",
        ],
      },
      {
        name: "milestones",
        rows: backup.tables.milestones,
        upsertKey: "id",
        columns: ["id", "nft_id", "type", "description", "location", "actor_address", "timestamp", "created_at"],
      },
      {
        name: "transfer_requests",
        rows: backup.tables.transfer_requests,
        upsertKey: "id",
        columns: ["id", "nft_id", "distributor_address", "pharmacy_address", "status", "object_id", "created_at", "updated_at"],
      },
      {
        name: "transfer_requests_v2",
        rows: backup.tables.transfer_requests_v2,
        upsertKey: "id",
        columns: ["id", "nft_id", "distributor_address", "pharmacy_address", "quantity", "transfer_note", "status", "expires_at", "created_at", "updated_at"],
      },
      {
        name: "notifications",
        rows: backup.tables.notifications,
        upsertKey: "id",
        columns: ["id", "user_id", "type", "title", "message", "read", "created_at"],
      },
      {
        name: "quality_alerts",
        rows: backup.tables.quality_alerts,
        upsertKey: "id",
        columns: ["id", "nft_id", "batch_number", "severity", "alert_type", "description", "location", "resolved", "created_at", "updated_at"],
      },
    ];

    for (const table of tables) {
      if (!table.rows || table.rows.length === 0) {
        restored[table.name] = 0;
        continue;
      }

      try {
        let count = 0;
        for (const row of table.rows) {
          const values: any[] = [];
          const placeholders: string[] = [];
          const updates: string[] = [];
          let paramIdx = 1;

          for (const col of table.columns) {
            if (row[col] !== undefined) {
              values.push(row[col]);
              placeholders.push(`$${paramIdx++}`);
              updates.push(`${col} = EXCLUDED.${col}`);
            }
          }

          if (placeholders.length === 0) continue;

          const query = `
            INSERT INTO ${table.name} (${table.columns.filter(c => row[c] !== undefined).join(", ")})
            VALUES (${placeholders.join(", ")})
            ON CONFLICT (${table.upsertKey}) DO UPDATE SET ${updates.join(", ")}
          `;

          await pool.query(query, values);
          count++;
        }
        restored[table.name] = count;
        logger.info("backup", `Restored ${count} rows into ${table.name}`);
      } catch (err: any) {
        errors.push(`${table.name}: ${err.message}`);
        restored[table.name] = 0;
        logger.error("backup", `Failed to restore ${table.name}: ${err.message}`);
      }
    }

    return { restored, errors };
  }
}

export const backupService = new BackupService();
