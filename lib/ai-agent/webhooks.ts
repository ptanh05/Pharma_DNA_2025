/**
 * Integration APIs - Webhooks
 * Webhook system cho external integrations
 */

import { pool } from "@/lib/db";
import axios from "axios";

export interface Webhook {
  id?: number;
  name?: string;
  url: string;
  events: string[];
  secret?: string;
  enabled: boolean;
  active?: boolean;
  headers?: Record<string, string>;
  retryCount?: number;
  successCount?: number;
  failureCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WebhookEvent {
  id?: string;
  webhookId: number;
  event: string;
  payload: any;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  lastAttempt?: Date;
  response?: any;
  createdAt: Date;
}

/**
 * Create webhook
 */
export async function createWebhook(webhook: Omit<Webhook, "id" | "createdAt" | "updatedAt">): Promise<Webhook> {
  const result = await pool.query(
    `INSERT INTO webhooks (name, url, events, secret, enabled, headers, retry_count, success_count, failure_count, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
     RETURNING *`,
    [
      webhook.name,
      webhook.url,
      JSON.stringify(webhook.events),
      webhook.secret || null,
      webhook.enabled !== false,
      webhook.headers ? JSON.stringify(webhook.headers) : null,
      0,
      0,
      0,
    ]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    events: JSON.parse(row.events),
    secret: row.secret,
    enabled: row.enabled,
    headers: row.headers ? JSON.parse(row.headers) : undefined,
    retryCount: row.retry_count,
    successCount: row.success_count,
    failureCount: row.failure_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Trigger webhook
 */
export async function triggerWebhook(event: string, payload: any): Promise<void> {
  try {
    // Find webhooks subscribed to this event
    const webhooks = await pool.query(
      `SELECT * FROM webhooks 
       WHERE enabled = true 
       AND events::text LIKE $1`,
      [`%${event}%`]
    );

    for (const webhookRow of webhooks.rows) {
      const webhook: Webhook = {
        id: webhookRow.id,
        name: webhookRow.name,
        url: webhookRow.url,
        events: JSON.parse(webhookRow.events),
        secret: webhookRow.secret,
        enabled: webhookRow.enabled,
        headers: webhookRow.headers ? JSON.parse(webhookRow.headers) : undefined,
        retryCount: webhookRow.retry_count,
        successCount: webhookRow.success_count,
        failureCount: webhookRow.failure_count,
        createdAt: webhookRow.created_at,
        updatedAt: webhookRow.updated_at,
      };

      // Create webhook event
      const eventResult = await pool.query(
        `INSERT INTO webhook_events (webhook_id, event, payload, status, attempts, created_at)
         VALUES ($1, $2, $3, 'pending', 0, NOW())
         RETURNING *`,
        [webhook.id, event, JSON.stringify(payload)]
      );

      const webhookEvent = eventResult.rows[0];

      // Send webhook asynchronously
      sendWebhook(webhook, webhookEvent.id, event, payload).catch((error) => {
        console.error(`Error sending webhook ${webhook.id}:`, error);
      });
    }
  } catch (error) {
    console.error("Error triggering webhook:", error);
  }
}

/**
 * Send webhook request
 */
async function sendWebhook(
  webhook: Webhook,
  eventId: string,
  event: string,
  payload: any,
  attempt: number = 1
): Promise<void> {
  try {
    const maxAttempts = 3;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Event": event,
      "X-Webhook-Id": webhook.id!.toString(),
      ...(webhook.headers || {}),
    };

    // Add signature if secret is provided
    if (webhook.secret) {
      const crypto = await import("crypto");
      const signature = crypto
        .createHmac("sha256", webhook.secret)
        .update(JSON.stringify(payload))
        .digest("hex");
      headers["X-Webhook-Signature"] = signature;
    }

    const response = await axios.post(webhook.url, payload, {
      headers,
      timeout: 10000, // 10 seconds
    });

    // Update event status
    await pool.query(
      `UPDATE webhook_events 
       SET status = 'delivered', attempts = $1, last_attempt = NOW(), response = $2
       WHERE id = $3`,
      [attempt, JSON.stringify({ status: response.status, data: response.data }), eventId]
    );

    // Update webhook stats
    await pool.query(
      `UPDATE webhooks 
       SET success_count = success_count + 1, updated_at = NOW()
       WHERE id = $1`,
      [webhook.id]
    );
  } catch (error: any) {
    // Update event with error
    await pool.query(
      `UPDATE webhook_events 
       SET attempts = $1, last_attempt = NOW(), response = $2
       WHERE id = $3`,
      [attempt, JSON.stringify({ error: error.message }), eventId]
    );

    // Retry if attempts < max
    // Note: setTimeout doesn't work well in serverless
    // In production, use queue system or Vercel Cron
    if (attempt < 3) {
      // For serverless, retry immediately or use queue
      const isServerless = typeof process !== "undefined" && process.env.VERCEL === "1";
      if (isServerless) {
        // In serverless, retry immediately (or use queue)
        // For now, just log and mark as failed after max attempts
        console.warn(`Webhook ${webhook.id} failed, will retry via queue or manual trigger`);
      } else {
        // Retry after exponential backoff (non-serverless)
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        setTimeout(() => {
          sendWebhook(webhook, eventId, event, payload, attempt + 1);
        }, delay);
      }
    }
    
    if (attempt >= 3) {
      // Mark as failed
      await pool.query(
        `UPDATE webhook_events 
         SET status = 'failed'
         WHERE id = $1`,
        [eventId]
      );

      // Update webhook stats
      await pool.query(
        `UPDATE webhooks 
         SET failure_count = failure_count + 1, updated_at = NOW()
         WHERE id = $1`,
        [webhook.id]
      );
    }
  }
}

/**
 * Get webhooks
 */
export async function getWebhooks(enabledOnly: boolean = false): Promise<Webhook[]> {
  const query = enabledOnly
    ? "SELECT * FROM webhooks WHERE enabled = true ORDER BY created_at DESC"
    : "SELECT * FROM webhooks ORDER BY created_at DESC";

  const result = await pool.query(query);
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    url: row.url,
    events: JSON.parse(row.events),
    secret: row.secret,
    enabled: row.enabled,
    headers: row.headers ? JSON.parse(row.headers) : undefined,
    retryCount: row.retry_count,
    successCount: row.success_count,
    failureCount: row.failure_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Update webhook
 */
export async function updateWebhook(webhookId: number, updates: Partial<Webhook>): Promise<Webhook> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramCount++}`);
    values.push(updates.name);
  }
  if (updates.url !== undefined) {
    fields.push(`url = $${paramCount++}`);
    values.push(updates.url);
  }
  if (updates.events !== undefined) {
    fields.push(`events = $${paramCount++}`);
    values.push(JSON.stringify(updates.events));
  }
  if (updates.secret !== undefined) {
    fields.push(`secret = $${paramCount++}`);
    values.push(updates.secret);
  }
  if (updates.enabled !== undefined) {
    fields.push(`enabled = $${paramCount++}`);
    values.push(updates.enabled);
  }
  if (updates.headers !== undefined) {
    fields.push(`headers = $${paramCount++}`);
    values.push(JSON.stringify(updates.headers));
  }

  fields.push(`updated_at = NOW()`);
  values.push(webhookId);

  const result = await pool.query(
    `UPDATE webhooks SET ${fields.join(", ")} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    throw new Error("Webhook not found");
  }

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    events: JSON.parse(row.events),
    secret: row.secret,
    enabled: row.enabled,
    headers: row.headers ? JSON.parse(row.headers) : undefined,
    retryCount: row.retry_count,
    successCount: row.success_count,
    failureCount: row.failure_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Delete webhook
 */
export async function deleteWebhook(webhookId: number): Promise<void> {
  await pool.query("DELETE FROM webhooks WHERE id = $1", [webhookId]);
}

/**
 * Get webhook events
 */
export async function getWebhookEvents(webhookId?: number, limit: number = 50): Promise<WebhookEvent[]> {
  let query = "SELECT * FROM webhook_events";
  const params: any[] = [];

  if (webhookId) {
    query += " WHERE webhook_id = $1";
    params.push(webhookId);
  }

  query += " ORDER BY created_at DESC LIMIT $" + (params.length + 1);
  params.push(limit);

  const result = await pool.query(query, params);
  return result.rows.map((row) => ({
    id: row.id,
    webhookId: row.webhook_id,
    event: row.event,
    payload: JSON.parse(row.payload),
    status: row.status,
    attempts: row.attempts,
    lastAttempt: row.last_attempt,
    response: row.response ? JSON.parse(row.response) : undefined,
    createdAt: row.created_at,
  }));
}

/**
 * Initialize webhooks tables
 */
export async function initializeWebhooks(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        events JSONB NOT NULL,
        secret VARCHAR(255),
        enabled BOOLEAN DEFAULT true,
        headers JSONB,
        retry_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id VARCHAR(100) PRIMARY KEY,
        webhook_id INTEGER REFERENCES webhooks(id) ON DELETE CASCADE,
        event VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(20) NOT NULL,
        attempts INTEGER DEFAULT 0,
        last_attempt TIMESTAMP,
        response JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (error) {
    console.error("Error initializing webhooks:", error);
  }
}

// Initialize on module load
if (typeof window === "undefined") {
  initializeWebhooks();
}

