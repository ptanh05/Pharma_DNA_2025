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
 */
export function useNotifications(pollInterval: number = 10000) {
  const { account } = useWalletSui();
  const { userRole } = useRoleAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const lastCheckRef = useRef<string>(new Date().toISOString());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
        if (data.notifications && data.notifications.length > 0) {
          // Add new notifications
          setNotifications((prev) => {
            const existingIds = new Set(prev.map((n) => n.id));
            const newNotifications = data.notifications.filter(
              (n: Notification) => !existingIds.has(n.id)
            );
            
            // Show toast for new notifications
            newNotifications.forEach((notification: Notification) => {
              toast.info(notification.title, {
                description: notification.message,
                duration: 5000,
              });
            });

            return [...newNotifications, ...prev].slice(0, 50); // Keep last 50
          });

          setUnreadCount((prev) => prev + data.notifications.length);
        }

        lastCheckRef.current = data.timestamp || new Date().toISOString();
      }
    } catch (error) {
      console.error("Error polling notifications:", error);
    } finally {
      setIsPolling(false);
    }
  }, [account, userRole]);

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

