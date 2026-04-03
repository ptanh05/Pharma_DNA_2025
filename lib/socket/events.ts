/**
 * Socket Event Emitters
 * Real-time notifications via Server-Sent Events (SSE).
 * Compatible with serverless environments (Vercel, etc.)
 */

import {
  broadcastToUser,
  broadcastToRole,
  broadcastToAll,
  SSEEvents,
} from "@/lib/sse";

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
  broadcastToUser(data.pharmacyAddress, SSEEvents.TRANSFER_REQUEST_CREATED, data);

  // Also emit to all pharmacies
  broadcastToRole("PHARMACY", SSEEvents.TRANSFER_REQUEST_CREATED, data);

  // Emit to distributor (sender)
  broadcastToUser(data.distributorAddress, SSEEvents.TRANSFER_REQUEST_CREATED, data);
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
  broadcastToUser(data.pharmacyAddress, SSEEvents.TRANSFER_REQUEST_UPDATED, data);
  broadcastToUser(data.distributorAddress, SSEEvents.TRANSFER_REQUEST_UPDATED, data);

  if (data.status === "approved") {
    broadcastToUser(
      data.distributorAddress,
      SSEEvents.TRANSFER_REQUEST_APPROVED,
      data
    );
  } else if (data.status === "rejected") {
    broadcastToUser(
      data.distributorAddress,
      SSEEvents.TRANSFER_REQUEST_REJECTED,
      data
    );
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
  broadcastToAll(SSEEvents.MILESTONE_ADDED, data);
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
  broadcastToUser(data.manufacturerAddress, SSEEvents.NFT_MINTED, data);

  // Emit to all manufacturers
  broadcastToRole("MANUFACTURER", SSEEvents.NFT_MINTED, data);
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
  broadcastToUser(data.from, SSEEvents.NFT_TRANSFERRED, data);
  broadcastToUser(data.to, SSEEvents.NFT_TRANSFERRED, data);
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
    data?: unknown;
  }
) {
  broadcastToUser(address, SSEEvents.NOTIFICATION, notification);
}
