"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SocketEventHandlers {
  onTransferRequestCreated?: (data: unknown) => void;
  onTransferRequestUpdated?: (data: unknown) => void;
  onTransferRequestApproved?: (data: unknown) => void;
  onTransferRequestRejected?: (data: unknown) => void;
  onMilestoneAdded?: (data: unknown) => void;
  onNFTMinted?: (data: unknown) => void;
  onNFTTransferred?: (data: unknown) => void;
  onNotification?: (data: unknown) => void;
}

interface SSEPayload {
  type: string;
  data: unknown;
}

type EmitFn = (event: string, data: unknown) => Promise<void>;

/**
 * Hook to use SSE (Server-Sent Events) for real-time notifications.
 * Uses the native browser EventSource API, compatible with serverless.
 */
export function useSocket(
  address?: string,
  role?: string,
  handlers?: SocketEventHandlers
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const handlersRef = useRef(handlers);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Keep handlers ref current without re-triggering the effect
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!address) return;

    // Clean up any existing connection
    disconnect();

    setIsConnecting(true);
    const url = `/api/sse?address=${encodeURIComponent(address)}${
      role ? `&role=${encodeURIComponent(role)}` : ""
    }`;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setIsConnecting(false);
      reconnectAttemptsRef.current = 0;
    };

    eventSource.onerror = (err) => {
      console.error("[SSE] Connection error:", err);
      setIsConnected(false);
      setIsConnecting(false);
      eventSource.close();
      eventSourceRef.current = null;

      // Exponential backoff reconnection
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      } else {
        // Max reconnection attempts reached
      }
    };

    // Handle all messages through the generic message event.
    // The SSE endpoint sends: data: {"type":"transfer-request:created","data":{...}}
    eventSource.onmessage = (event: MessageEvent) => {
      let payload: SSEPayload;

      try {
        payload = JSON.parse(event.data as string) as SSEPayload;
      } catch {
        return;
      }

      // Skip internal heartbeat and connection messages
      if (payload.type === "__heartbeat" || payload.type === "__connected") {
        return;
      }

      const h = handlersRef.current;
      if (!h) return;

      switch (payload.type) {
        case "transfer-request:created":
          h.onTransferRequestCreated?.(payload.data);
          break;
        case "transfer-request:updated":
          h.onTransferRequestUpdated?.(payload.data);
          break;
        case "transfer-request:approved":
          h.onTransferRequestApproved?.(payload.data);
          break;
        case "transfer-request:rejected":
          h.onTransferRequestRejected?.(payload.data);
          break;
        case "milestone:added":
          h.onMilestoneAdded?.(payload.data);
          break;
        case "nft:minted":
          h.onNFTMinted?.(payload.data);
          break;
        case "nft:transferred":
          h.onNFTTransferred?.(payload.data);
          break;
        case "notification":
          h.onNotification?.(payload.data);
          break;
        default:
          break;
      }
    };
  }, [address, role, disconnect]);

  useEffect(() => {
    if (address) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [address, role, connect, disconnect]);

  /**
   * Emit sends a POST request to /api/socket which forwards to SSE broadcast.
   * This is needed because EventSource only receives — it cannot send data.
   */
  const emit: EmitFn = useCallback(
    async (event: string, data: unknown) => {
      if (!address) return;

      try {
        const response = await fetch("/api/socket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, data }),
        });

        if (!response.ok) {
          console.error(`[Socket] emit failed: ${response.status}`);
        }
      } catch (err) {
        console.error("[Socket] emit error:", err);
      }
    },
    [address]
  );

  return {
    socket: eventSourceRef.current,
    isConnected,
    isConnecting,
    emit,
  };
}
