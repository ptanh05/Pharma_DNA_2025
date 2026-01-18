/**
 * Socket.io Server Setup
 * Handles real-time communication for transfer requests, milestones, etc.
 */

import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";

let io: SocketIOServer | null = null;

/**
 * Initialize Socket.io server
 */
export function initSocketIO(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    return io;
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/api/socket",
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Join room based on wallet address
    socket.on("join-room", (data: { address: string; role?: string }) => {
      if (data.address) {
        const room = `user:${data.address.toLowerCase()}`;
        socket.join(room);
        console.log(`[Socket] Client ${socket.id} joined room: ${room}`);
      }

      // Also join role-based room
      if (data.role) {
        const roleRoom = `role:${data.role}`;
        socket.join(roleRoom);
        console.log(`[Socket] Client ${socket.id} joined role room: ${roleRoom}`);
      }
    });

    // Leave room
    socket.on("leave-room", (data: { address: string; role?: string }) => {
      if (data.address) {
        const room = `user:${data.address.toLowerCase()}`;
        socket.leave(room);
      }
      if (data.role) {
        const roleRoom = `role:${data.role}`;
        socket.leave(roleRoom);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Get Socket.io server instance
 */
export function getSocketIO(): SocketIOServer | null {
  return io;
}

/**
 * Emit event to specific user
 */
export function emitToUser(address: string, event: string, data: any) {
  if (!io) return;
  const room = `user:${address.toLowerCase()}`;
  io.to(room).emit(event, data);
  console.log(`[Socket] Emitted ${event} to room: ${room}`);
}

/**
 * Emit event to all users with specific role
 */
export function emitToRole(role: string, event: string, data: any) {
  if (!io) return;
  const room = `role:${role}`;
  io.to(room).emit(event, data);
  console.log(`[Socket] Emitted ${event} to role room: ${room}`);
}

/**
 * Emit event to all connected clients
 */
export function emitToAll(event: string, data: any) {
  if (!io) return;
  io.emit(event, data);
  console.log(`[Socket] Emitted ${event} to all clients`);
}

/**
 * Socket Events
 */
export const SocketEvents = {
  // Transfer Request Events
  TRANSFER_REQUEST_CREATED: "transfer-request:created",
  TRANSFER_REQUEST_UPDATED: "transfer-request:updated",
  TRANSFER_REQUEST_APPROVED: "transfer-request:approved",
  TRANSFER_REQUEST_REJECTED: "transfer-request:rejected",

  // Milestone Events
  MILESTONE_ADDED: "milestone:added",

  // NFT Events
  NFT_MINTED: "nft:minted",
  NFT_TRANSFERRED: "nft:transferred",

  // Notification Events
  NOTIFICATION: "notification",
} as const;

