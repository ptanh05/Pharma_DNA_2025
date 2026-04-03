"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode, useEffect, useRef } from "react";

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * React Query Provider v2 — Tối ưu cache cho PharmaDNA
 *
 * Improvements:
 * - Unified default staleTime/gcTime via provider defaults
 * - localStorage persistence with quota safety (skip if full)
 * - Debounced save to avoid excessive writes
 * - Removes duplicate refetchOnWindowFocus option
 */
export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10 * 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnMount: false,
            gcTime: 24 * 60 * 60 * 1000,
            retry: 3,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  const persistKey = "pharmadna-query-cache-v2";
  const isInitialized = useRef(false);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || isInitialized.current) return;
    isInitialized.current = true;

    // Restore cache from localStorage (only data < 4 hours old)
    try {
      const saved = localStorage.getItem(persistKey);
      if (saved) {
        const cache = JSON.parse(saved) as Record<string, { data: unknown; timestamp: number }>;
        const cutoff = Date.now() - 4 * 60 * 60 * 1000;
        Object.entries(cache).forEach(([key, value]) => {
          if (value?.data && value.timestamp > cutoff) {
            queryClient.setQueryData(key, value.data);
          }
        });
      }
    } catch {
      // localStorage may be unavailable or corrupted — skip silently
    }

    // Debounced save (1.5s after last change)
    const saveCache = () => {
      try {
        const cacheData: Record<string, unknown> = {};
        queryClient.getQueryCache().getAll().forEach((query) => {
          if (query.state?.data !== undefined) {
            cacheData[JSON.stringify(query.queryKey)] = {
              data: query.state.data,
              timestamp: Date.now(),
            };
          }
        });
        const serialized = JSON.stringify(cacheData);
        if (serialized.length < 2 * 1024 * 1024) {
          localStorage.setItem(persistKey, serialized);
        } else {
          localStorage.removeItem(persistKey);
        }
      } catch {
        // Clean up old v1 cache key
    try { localStorage.removeItem("pharmadna-query-cache"); } catch { /* ignore */ }
    // Quota exceeded or unavailable — skip silently
      }
    };

    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(saveCache, 1500);
    });

    const handleUnload = () => saveCache();
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      unsubscribe();
      window.removeEventListener("beforeunload", handleUnload);
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
