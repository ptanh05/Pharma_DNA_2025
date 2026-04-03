/**
 * SSE (Server-Sent Events) Core Utilities
 * Shared by both the SSE route handler and lib/socket/event emitters.
 * Works in serverless environments (Vercel, etc.) using in-memory connections.
 */

// ReadableStreamDefaultController is available via the "dom" lib in tsconfig.json

// ─── Types ────────────────────────────────────────────────────────────────────

export type SSEController = ReadableStreamDefaultController<Uint8Array>;

interface ConnectionEntry {
  controller: SSEController;
  address: string;
  role?: string;
  lastHeartbeat: number;
}

// ─── In-Memory Connection Registry ──────────────────────────────────────────
// Key: client address (wallet address). Value: connection entry.
// In serverless, this Map is scoped to the running Lambda/Edge function instance.
// For production at scale, replace with Redis pub/sub or a dedicated SSE service.

const connections = new Map<string, ConnectionEntry>();

// ─── SSE Events Registry ─────────────────────────────────────────────────────

export const SSEEvents = {
  TRANSFER_REQUEST_CREATED: "transfer-request:created",
  TRANSFER_REQUEST_UPDATED: "transfer-request:updated",
  TRANSFER_REQUEST_APPROVED: "transfer-request:approved",
  TRANSFER_REQUEST_REJECTED: "transfer-request:rejected",
  MILESTONE_ADDED: "milestone:added",
  NFT_MINTED: "nft:minted",
  NFT_TRANSFERRED: "nft:transferred",
  NOTIFICATION: "notification",
} as const;

export type SSEEventName =
  (typeof SSEEvents)[keyof typeof SSEEvents];

// ─── Connection Management ───────────────────────────────────────────────────

/**
 * Add an SSE connection for a client address.
 * If the address already has an active connection, the old one is closed and replaced.
 */
export function addSSEConnection(
  address: string,
  controller: SSEController,
  role?: string
) {
  const normalized = address.toLowerCase();

  // Close existing connection for this address if any
  const existing = connections.get(normalized);
  if (existing) {
    try {
      existing.controller.close();
    } catch {
      // Already closed
    }
  }

  connections.set(normalized, {
    controller,
    address: normalized,
    role,
    lastHeartbeat: Date.now(),
  });
}

/**
 * Remove an SSE connection by address.
 */
export function removeSSEConnection(address: string) {
  const entry = connections.get(address.toLowerCase());
  if (entry) {
    connections.delete(address.toLowerCase());
  }
}

/**
 * Send a message to a specific user by wallet address.
 */
export function broadcastToUser(
  address: string,
  event: string,
  data: unknown
) {
  const entry = connections.get(address.toLowerCase());
  if (!entry) return;

  const message = formatSSEMessage(event, data);
  try {
    entry.controller.enqueue(new TextEncoder().encode(message));
    entry.lastHeartbeat = Date.now();
  } catch {
    removeSSEConnection(address);
  }
}

/**
 * Send a message to all users who have a specific role.
 */
export function broadcastToRole(
  role: string,
  event: string,
  data: unknown
) {
  const message = formatSSEMessage(event, data);
  const deadConnections: string[] = [];

  for (const [addr, entry] of Array.from(connections)) {
    if (entry.role === role) {
      try {
        entry.controller.enqueue(new TextEncoder().encode(message));
        entry.lastHeartbeat = Date.now();
      } catch {
        deadConnections.push(addr);
      }
    }
  }

  deadConnections.forEach(removeSSEConnection);
}

/**
 * Send a message to all connected SSE clients.
 */
export function broadcastToAll(event: string, data: unknown) {
  const message = formatSSEMessage(event, data);
  const deadConnections: string[] = [];

  for (const [addr, entry] of Array.from(connections)) {
    try {
      entry.controller.enqueue(new TextEncoder().encode(message));
      entry.lastHeartbeat = Date.now();
    } catch {
      deadConnections.push(addr);
    }
  }

  deadConnections.forEach(removeSSEConnection);
}

/**
 * Format data as an SSE message string.
 * Uses a "message" event with JSON payload containing both the event type
 * and the data — this works across all browsers with EventSource.
 */
export function formatSSEMessage(event: string, data: unknown): string {
  const payload = JSON.stringify({ type: event, data });
  return `data: ${payload}\n\n`;
}

// ─── Heartbeat / Cleanup ─────────────────────────────────────────────────────

/**
 * Periodic cleanup of stale connections and heartbeat pings.
 * Runs every 30 seconds.
 */
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupIntervalId) return;

  cleanupIntervalId = setInterval(() => {
    const now = Date.now();
    const heartbeatInterval = 60_000; // 60s — allow some grace beyond 30s heartbeat
    const deadConnections: string[] = [];

    for (const [addr, entry] of Array.from(connections)) {
      if (now - entry.lastHeartbeat > heartbeatInterval) {
        deadConnections.push(addr);
      } else {
        // Send heartbeat
        try {
          const heartbeat = formatSSEMessage("__heartbeat", { ts: now });
          entry.controller.enqueue(new TextEncoder().encode(heartbeat));
          entry.lastHeartbeat = now;
        } catch {
          deadConnections.push(addr);
        }
      }
    }

    for (const addr of deadConnections) {
      const entry = connections.get(addr);
      if (entry) {
        try {
          entry.controller.close();
        } catch {
          // Already closed
        }
        connections.delete(addr);
      }
    }
  }, 30_000);
}

export { startCleanup };

// For debugging/monitoring
export function getActiveConnectionCount(): number {
  return connections.size;
}
