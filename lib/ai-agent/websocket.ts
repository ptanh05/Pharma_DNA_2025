/**
 * Real-time WebSocket Support
 * WebSocket server cho real-time updates
 */

import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { pool } from "@/lib/db";

let io: SocketIOServer | null = null;

/**
 * Initialize WebSocket server
 * Note: WebSocket doesn't work on Vercel serverless
 * Use Vercel Realtime or external service instead
 */
export function initializeWebSocket(server: HTTPServer): SocketIOServer | null {
  // Check if running in serverless environment
  if (typeof process !== "undefined" && process.env.VERCEL === "1") {
    console.warn("WebSocket is not supported on Vercel serverless. Use Vercel Realtime or external service.");
    return null;
  }

  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "*",
      methods: ["GET", "POST"],
    },
    path: "/api/ai-agent/ws",
  });

  io.on("connection", (socket) => {
    // Join room by session ID
    socket.on("join", (sessionId: string) => {
      socket.join(`session:${sessionId}`);
    });

    // Join room by role
    socket.on("join-role", (role: string) => {
      socket.join(`role:${role}`);
    });

    // Subscribe to NFT updates
    socket.on("subscribe-nft", (nftId: number) => {
      socket.join(`nft:${nftId}`);
    });

    // Subscribe to workflow updates
    socket.on("subscribe-workflow", (workflowId: number) => {
      socket.join(`workflow:${workflowId}`);
    });

    socket.on("disconnect", () => {
    });
  });

  return io;
}

/**
 * Get WebSocket server instance
 */
export function getWebSocketServer(): SocketIOServer | null {
  return io;
}

/**
 * Check if WebSocket is available
 */
export function isWebSocketAvailable(): boolean {
  return typeof process !== "undefined" && process.env.VERCEL !== "1" && io !== null;
}

/**
 * Emit event to session
 */
export function emitToSession(sessionId: string, event: string, data: any): void {
  if (!io || !isWebSocketAvailable()) return;
  io.to(`session:${sessionId}`).emit(event, data);
}

/**
 * Emit event to role
 */
export function emitToRole(role: string, event: string, data: any): void {
  if (!io || !isWebSocketAvailable()) return;
  io.to(`role:${role}`).emit(event, data);
}

/**
 * Emit NFT update
 */
export function emitNFTUpdate(nftId: number, update: any): void {
  if (!io || !isWebSocketAvailable()) return;
  io.to(`nft:${nftId}`).emit("nft-update", { nftId, ...update });
}

/**
 * Emit workflow execution update
 */
export function emitWorkflowUpdate(workflowId: number, update: any): void {
  if (!io || !isWebSocketAvailable()) return;
  io.to(`workflow:${workflowId}`).emit("workflow-update", { workflowId, ...update });
}

/**
 * Emit agent task progress
 */
export function emitTaskProgress(sessionId: string, progress: {
  step: string;
  status: "running" | "completed" | "failed";
  progress: number; // 0-100
  message?: string;
}): void {
  if (!io || !isWebSocketAvailable()) return;
  io.to(`session:${sessionId}`).emit("task-progress", progress);
}

/**
 * Emit system alert
 */
export function emitSystemAlert(alert: {
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  role?: string;
}): void {
  if (!io || !isWebSocketAvailable()) return;
  
  if (alert.role) {
    emitToRole(alert.role, "system-alert", alert);
  } else {
    io.emit("system-alert", alert);
  }
}

/**
 * Broadcast to all connected clients
 */
export function broadcast(event: string, data: any): void {
  if (!io || !isWebSocketAvailable()) return;
  io.emit(event, data);
}

/**
 * Get connected clients count
 */
export function getConnectedCount(): number {
  if (!io || !isWebSocketAvailable()) return 0;
  return io.sockets.sockets.size;
}

/**
 * Get clients in room
 */
export function getRoomClients(room: string): number {
  if (!io || !isWebSocketAvailable()) return 0;
  const roomObj = io.sockets.adapter.rooms.get(room);
  return roomObj ? roomObj.size : 0;
}

