"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "/api/socket";

export interface SocketEventHandlers {
  onTransferRequestCreated?: (data: any) => void;
  onTransferRequestUpdated?: (data: any) => void;
  onTransferRequestApproved?: (data: any) => void;
  onTransferRequestRejected?: (data: any) => void;
  onMilestoneAdded?: (data: any) => void;
  onNFTMinted?: (data: any) => void;
  onNFTTransferred?: (data: any) => void;
  onNotification?: (data: any) => void;
}

/**
 * Hook to use Socket.io client
 */
export function useSocket(
  address?: string,
  role?: string,
  handlers?: SocketEventHandlers
) {
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const handlersRef = useRef(handlers);

  // Update handlers ref when handlers change
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io(SOCKET_URL, {
      path: "/api/socket",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketInstance.on("connect", () => {
      console.log("[Socket] Connected:", socketInstance.id);
      setIsConnected(true);

      // Join user room if address provided
      if (address) {
        socketInstance.emit("join-room", { address, role });
      }
    });

    socketInstance.on("disconnect", () => {
      console.log("[Socket] Disconnected");
      setIsConnected(false);
    });

    socketInstance.on("connect_error", (error: Error) => {
      console.error("[Socket] Connection error:", error);
      setIsConnected(false);
    });

    // Register event handlers
    if (handlersRef.current) {
      const h = handlersRef.current;

      if (h.onTransferRequestCreated) {
        socketInstance.on("transfer-request:created", h.onTransferRequestCreated);
      }
      if (h.onTransferRequestUpdated) {
        socketInstance.on("transfer-request:updated", h.onTransferRequestUpdated);
      }
      if (h.onTransferRequestApproved) {
        socketInstance.on("transfer-request:approved", h.onTransferRequestApproved);
      }
      if (h.onTransferRequestRejected) {
        socketInstance.on("transfer-request:rejected", h.onTransferRequestRejected);
      }
      if (h.onMilestoneAdded) {
        socketInstance.on("milestone:added", h.onMilestoneAdded);
      }
      if (h.onNFTMinted) {
        socketInstance.on("nft:minted", h.onNFTMinted);
      }
      if (h.onNFTTransferred) {
        socketInstance.on("nft:transferred", h.onNFTTransferred);
      }
      if (h.onNotification) {
        socketInstance.on("notification", h.onNotification);
      }
    }

    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      if (address) {
        socketInstance.emit("leave-room", { address, role });
      }
      socketInstance.disconnect();
    };
  }, [address, role]);

  return {
    socket,
    isConnected,
    emit: (event: string, data: any) => {
      if (socket) {
        socket.emit(event, data);
      }
    },
  };
}

