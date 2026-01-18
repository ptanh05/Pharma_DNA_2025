/**
 * Socket Event Emitters
 * Functions to emit events from API routes
 * Note: For serverless environments, we'll use a polling/SSE approach
 */

import { getSocketIO, emitToUser, emitToRole, emitToAll, SocketEvents } from "./server";

/**
 * Emit transfer request created event
 */
export function emitTransferRequestCreated(data: {
  requestId: number;
  nftId: number | string;
  distributorAddress: string;
  pharmacyAddress: string;
  status: string;
}) {
  // Emit to pharmacy (recipient)
  emitToUser(data.pharmacyAddress, SocketEvents.TRANSFER_REQUEST_CREATED, data);
  
  // Also emit to all pharmacies
  emitToRole("PHARMACY", SocketEvents.TRANSFER_REQUEST_CREATED, data);
  
  // Emit to distributor (sender)
  emitToUser(data.distributorAddress, SocketEvents.TRANSFER_REQUEST_CREATED, data);
}

/**
 * Emit transfer request updated event
 */
export function emitTransferRequestUpdated(data: {
  requestId: number;
  nftId: number | string;
  distributorAddress: string;
  pharmacyAddress: string;
  status: string;
  updatedAt: string;
}) {
  // Emit to both parties
  emitToUser(data.pharmacyAddress, SocketEvents.TRANSFER_REQUEST_UPDATED, data);
  emitToUser(data.distributorAddress, SocketEvents.TRANSFER_REQUEST_UPDATED, data);

  if (data.status === "approved") {
    emitToUser(data.distributorAddress, SocketEvents.TRANSFER_REQUEST_APPROVED, data);
  } else if (data.status === "rejected") {
    emitToUser(data.distributorAddress, SocketEvents.TRANSFER_REQUEST_REJECTED, data);
  }
}

/**
 * Emit milestone added event
 */
export function emitMilestoneAdded(data: {
  milestoneId: number;
  nftId: number | string;
  batchNumber?: string;
  type: string;
  description?: string;
  location?: string;
  actorAddress: string;
  timestamp: string;
}) {
  // Emit to all users who might be tracking this NFT
  // In a real app, you'd track which users are watching which NFTs
  emitToAll(SocketEvents.MILESTONE_ADDED, data);
}

/**
 * Emit NFT minted event
 */
export function emitNFTMinted(data: {
  objectId: string;
  batchNumber: string;
  manufacturerAddress: string;
  transactionDigest: string;
}) {
  // Emit to manufacturer
  emitToUser(data.manufacturerAddress, SocketEvents.NFT_MINTED, data);
  
  // Emit to all manufacturers
  emitToRole("MANUFACTURER", SocketEvents.NFT_MINTED, data);
}

/**
 * Emit NFT transferred event
 */
export function emitNFTTransferred(data: {
  objectId: string;
  from: string;
  to: string;
  transactionDigest: string;
}) {
  // Emit to both parties
  emitToUser(data.from, SocketEvents.NFT_TRANSFERRED, data);
  emitToUser(data.to, SocketEvents.NFT_TRANSFERRED, data);
}

/**
 * Emit notification
 */
export function emitNotification(
  address: string,
  notification: {
    type: "info" | "success" | "warning" | "error";
    title: string;
    message: string;
    data?: any;
  }
) {
  emitToUser(address, SocketEvents.NOTIFICATION, notification);
}

