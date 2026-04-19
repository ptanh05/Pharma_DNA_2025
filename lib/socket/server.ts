/**
 * Socket.io Server Setup
 *
 * DEPRECATED: This module is kept for backward compatibility.
 * Real-time communication now uses Server-Sent Events (SSE) via /api/sse.
 *
 * All functions delegate to the SSE implementation in lib/sse.
 * Import from lib/socket/events.ts for emitting events.
 */

import {
  broadcastToUser,
  broadcastToRole,
  broadcastToAll,
  SSEEvents,
} from "@/lib/sse";
import { logger } from "@/lib/utils/logger";

/**
 * @deprecated - SSE connections are managed internally by lib/sse.
 */
export function initSocketIO(_httpServer: unknown): null {
  logger.warn("SOCKET", "initSocketIO is deprecated, using SSE instead, see /api/sse", {});
  return null;
}

/**
 * @deprecated - Use the SSE broadcast functions from lib/socket/events.ts
 */
export function getSocketIO(): null {
  return null;
}

/**
 * Emit event to specific user.
 * Delegates to SSE broadcastToUser.
 */
export function emitToUser(address: string, event: string, data: unknown) {
  broadcastToUser(address, event, data);
}

/**
 * Emit event to all users with specific role.
 * Delegates to SSE broadcastToRole.
 */
export function emitToRole(role: string, event: string, data: unknown) {
  broadcastToRole(role, event, data);
}

/**
 * Emit event to all connected clients.
 * Delegates to SSE broadcastToAll.
 */
export function emitToAll(event: string, data: unknown) {
  broadcastToAll(event, data);
}

/**
 * Socket Events — re-exported from SSE for backward compatibility.
 */
export const SocketEvents = SSEEvents;
