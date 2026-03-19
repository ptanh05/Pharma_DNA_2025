"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode, useEffect, useRef } from "react";

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * React Query Provider - Tối ưu cache cho PharmaDNA
 * - staleTime: 10 phút (data được coi là fresh)
 * - gcTime: 24 giờ (cache được giữ lâu)
 * - Không refetch khi focus/ mount
 */
export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data được coi là fresh trong 10 phút - giảm refetch
            staleTime: 10 * 60 * 1000,
            // Không refetch khi window focus
            refetchOnWindowFocus: false,
            // Retry failed requests 3 times
            retry: 3,
            // Không refetch on mount - dùng cache có sẵn
            refetchOnMount: false,
            // Cache giữ trong 24 tiếng
            gcTime: 24 * 60 * 60 * 1000,
          },
        },
      })
  );

  // Persist cache vào localStorage thủ công
  const persistKey = "pharmadna-query-cache";
  const isInitialized = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || isInitialized.current) return;
    isInitialized.current = true;

    // Load cache từ localStorage khi khởi động
    try {
      const savedCache = localStorage.getItem(persistKey);
      if (savedCache) {
        const cache = JSON.parse(savedCache);
        // Restore queries vào cache
        Object.entries(cache).forEach(([key, value]: [string, any]) => {
          if (value?.data) {
            queryClient.setQueryData(key, value.data);
          }
        });
        console.log("[QueryProvider] Cache restored from localStorage");
      }
    } catch (e) {
      console.error("[QueryProvider] Error restoring cache:", e);
    }

    // Save cache vào localStorage mỗi khi có thay đổi
    const saveCache = () => {
      try {
        const cacheData: Record<string, any> = {};
        queryClient.getQueryCache().getAll().forEach((query) => {
          const key = JSON.stringify(query.queryKey);
          if (key && query.state?.data !== undefined) {
            cacheData[key] = {
              data: query.state.data,
              timestamp: Date.now(),
            };
          }
        });
        localStorage.setItem(persistKey, JSON.stringify(cacheData));
      } catch (e) {
        // Ignore quota errors
      }
    };

    // Debounce save
    let timeout: NodeJS.Timeout;
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      clearTimeout(timeout);
      timeout = setTimeout(saveCache, 1000);
    });

    // Save on page unload
    const handleUnload = () => saveCache();
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      unsubscribe();
      window.removeEventListener("beforeunload", handleUnload);
      clearTimeout(timeout);
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
