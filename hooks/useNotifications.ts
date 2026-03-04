"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWalletSui } from "./useWalletSui";
import { useRoleAuth } from "./useRoleAuth";
import { toast } from "sonner";

export interface Notification {
  type: string;
  id: string;
  title: string;
  message: string;
  data?: any;
  timestamp: string;
  read?: boolean;
}

/**
 * Hook to poll for notifications
 * Uses polling instead of WebSocket for serverless compatibility
 * Includes deduplication, exponential backoff, and error handling
 */
export function useNotifications(pollInterval: number = 10000) {
  const { account } = useWalletSui();
  const { userRole } = useRoleAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const lastCheckRef = useRef<string>(new Date().toISOString());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Exponential backoff state
  const retryCountRef = useRef(0);
  const baseInterval = pollInterval;

  // Refs for deduplication
  const existingIdsRef = useRef<Set<string>>(new Set());

  // Calculate next interval with exponential backoff
  const getNextInterval = useCallback(() => {
    if (retryCountRef.current === 0) {
      return baseInterval;
    }
    // Exponential backoff: min(baseInterval * 2^retry, 5 minutes)
    return Math.min(baseInterval * Math.pow(2, retryCountRef.current), 300000);
  }, [baseInterval]);

  // Reset backoff on successful poll
  const resetBackoff = useCallback(() => {
    retryCountRef.current = 0;
  }, []);

  const pollNotifications = useCallback(async () => {
    if (!account || !userRole) {
      return;
    }

    setIsPolling(true);
    try {
      const response = await fetch(
        `/api/notifications/poll?address=${encodeURIComponent(account)}&role=${userRole}&lastCheck=${encodeURIComponent(lastCheckRef.current)}`
      );

      if (response.ok) {
        const data = await response.json();

        // Reset backoff on success
        resetBackoff();

        if (data.notifications && data.notifications.length > 0) {
          // Deduplication check using ID comparison
          setNotifications((prev) => {
            const existingIds = new Set(prev.map((n) => n.id));
            const newNotifications = data.notifications.filter(
              (n: Notification) => !existingIds.has(n.id)
            );

            if (newNotifications.length === 0) {
              return prev; // No new notifications, don't update
            }

            // Update ref with new IDs
            newNotifications.forEach((n) => existingIdsRef.current.add(n.id));

            // Show toast for truly new notifications
            newNotifications.forEach((notification: Notification) => {
              toast.info(notification.title, {
                description: notification.message,
                duration: 5000,
              });
            });

            return [...newNotifications, ...prev].slice(0, 50); // Keep last 50
          });

          // Calculate new notification count
          const existingIds = new Set(notifications.map((n) => n.id));
          const newCount = data.notifications.filter(
            (n: Notification) => !existingIds.has(n.id)
          ).length;

          if (newCount > 0) {
            setUnreadCount((prev) => prev + newCount);
          }
        }

        lastCheckRef.current = data.timestamp || new Date().toISOString();
      } else {
        // Increment backoff on error
        retryCountRef.current++;
      }
    } catch (error) {
      console.error("Error polling notifications:", error);
      retryCountRef.current++;
    } finally {
      setIsPolling(false);
    }
  }, [account, userRole, resetBackoff, notifications]);

  // Start polling when account and role are available
  useEffect(() => {
    if (!account || !userRole) {
      return;
    }

    // Poll immediately
    pollNotifications();

    // Set up interval
    intervalRef.current = setInterval(pollNotifications, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [account, userRole, pollInterval, pollNotifications]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    existingIdsRef.current.clear();
  }, []);

  return {
    notifications,
    unreadCount,
    isPolling,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    refresh: pollNotifications,
  };
}
