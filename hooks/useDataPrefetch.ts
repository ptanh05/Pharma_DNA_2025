"use client";

import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS, CACHE, PREFETCH_STAGGER_MS } from "@/lib/config/cache-config";

/**
 * Prefetch data when user hovers over navigation links.
 * This makes page transitions feel instant.
 *
 * Usage:
 *   const { prefetchOnHover } = useDataPrefetch();
 *   <Link href="/manufacturer" onMouseEnter={prefetchOnHover('manufacturer')} />
 */
export function useDataPrefetch() {
  const queryClient = useQueryClient();
  const staggerRef = useRef(0);

  const prefetch = useCallback(
    async (fetcher: () => Promise<unknown>) => {
      // Stagger prefetches to avoid overwhelming the server
      staggerRef.current++;
      const delay = (staggerRef.current - 1) * PREFETCH_STAGGER_MS;
      await new Promise((r) => setTimeout(r, delay));
      try {
        await fetcher();
      } catch {
        // Silent fail — prefetch is best-effort
      }
    },
    []
  );

  const prefetchManufacturer = useCallback(
    (account?: string) => {
      return prefetch(async () => {
        queryClient.prefetchQuery({
          queryKey: QUERY_KEYS.manufacturer.transferRequests(),
          queryFn: async () => {
            const res = await fetch("/api/manufacturer/transfer-request");
            return res.ok ? res.json() : null;
          },
          staleTime: CACHE.PENDING_DATA.staleTime,
          gcTime: CACHE.PENDING_DATA.gcTime,
        });

        if (account) {
          queryClient.prefetchQuery({
            queryKey: QUERY_KEYS.manufacturer.nfts(account),
            queryFn: async () => {
              const res = await fetch(`/api/manufacturer/nfts?address=${account}`);
              return res.ok ? res.json() : null;
            },
            staleTime: CACHE.USER_DATA.staleTime,
            gcTime: CACHE.USER_DATA.gcTime,
          });
        }

        queryClient.prefetchQuery({
          queryKey: QUERY_KEYS.manufacturer.milestones(),
          queryFn: async () => {
            const token =
              typeof window !== "undefined"
                ? localStorage.getItem("admin_token")
                : null;
            const res = await fetch("/api/manufacturer/milestone", {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            return res.ok ? res.json() : null;
          },
          staleTime: CACHE.PENDING_DATA.staleTime,
          gcTime: CACHE.PENDING_DATA.gcTime,
        });
      });
    },
    [queryClient, prefetch]
  );

  const prefetchDistributor = useCallback(
    (account?: string) => {
      return prefetch(async () => {
        queryClient.prefetchQuery({
          queryKey: QUERY_KEYS.distributor.allNfts(),
          queryFn: async () => {
            const res = await fetch("/api/distributor/nfts");
            return res.ok ? res.json() : null;
          },
          staleTime: CACHE.USER_DATA.staleTime,
          gcTime: CACHE.USER_DATA.gcTime,
        });

        if (account) {
          queryClient.prefetchQuery({
            queryKey: QUERY_KEYS.distributor.nfts(account),
            queryFn: async () => {
              const res = await fetch(`/api/distributor/nfts?address=${account}`);
              return res.ok ? res.json() : null;
            },
            staleTime: CACHE.USER_DATA.staleTime,
            gcTime: CACHE.USER_DATA.gcTime,
          });

          queryClient.prefetchQuery({
            queryKey: QUERY_KEYS.distributor.transfers(account),
            queryFn: async () => {
              const res = await fetch(`/api/manufacturer/transfer-request?distributor=${account}`);
              return res.ok ? res.json() : null;
            },
            staleTime: CACHE.PENDING_DATA.staleTime,
            gcTime: CACHE.PENDING_DATA.gcTime,
          });
        }
      });
    },
    [queryClient, prefetch]
  );

  const prefetchPharmacy = useCallback(
    (account?: string) => {
      return prefetch(async () => {
        if (!account) return;

        queryClient.prefetchQuery({
          queryKey: QUERY_KEYS.pharmacy.inventory(account),
          queryFn: async () => {
            const res = await fetch(`/api/pharmacy/inventory?address=${account}`);
            if (!res.ok) return null;
            const data = await res.json();
            return data.data?.inventory || data.data || [];
          },
          staleTime: CACHE.USER_DATA.staleTime,
          gcTime: CACHE.USER_DATA.gcTime,
        });

        queryClient.prefetchQuery({
          queryKey: QUERY_KEYS.pharmacy.pendingCount(account),
          queryFn: async () => {
            const res = await fetch(
              `/api/distributor/transfer-to-pharmacy?pharmacy_address=${account}&status=pending`
            );
            if (!res.ok) return 0;
            const data = await res.json();
            const requests = data.data || data;
            return Array.isArray(requests) ? requests.length : 0;
          },
          staleTime: CACHE.PENDING_DATA.staleTime,
          gcTime: CACHE.PENDING_DATA.gcTime,
        });
      });
    },
    [queryClient, prefetch]
  );

  const prefetchAdmin = useCallback(() => {
    return prefetch(async () => {
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.admin.users(),
        queryFn: async () => {
          const res = await fetch("/api/admin/users");
          return res.ok ? res.json() : null;
        },
        staleTime: CACHE.ADMIN_DATA.staleTime,
        gcTime: CACHE.ADMIN_DATA.gcTime,
      });

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("admin_token")
          : null;
      if (token) {
        queryClient.prefetchQuery({
          queryKey: QUERY_KEYS.admin.stats(),
          queryFn: async () => {
            const res = await fetch("/api/admin/stats?period=all", {
              headers: { Authorization: `Bearer ${token}` },
            });
            return res.ok ? res.json() : null;
          },
          staleTime: CACHE.ADMIN_DATA.staleTime,
          gcTime: CACHE.ADMIN_DATA.gcTime,
        });
      }
    });
  }, [queryClient, prefetch]);

  const prefetchPublic = useCallback(
    (code: string) => {
      if (!code || code.length < 3) return;
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.public.lookup(code),
        queryFn: async () => {
          const res = await fetch(`/api/public/lookup?code=${encodeURIComponent(code)}`);
          return res.ok ? res.json() : null;
        },
        staleTime: CACHE.PUBLIC_DATA.staleTime,
        gcTime: CACHE.PUBLIC_DATA.gcTime,
      });
    },
    [queryClient]
  );

  return {
    prefetchManufacturer,
    prefetchDistributor,
    prefetchPharmacy,
    prefetchAdmin,
    prefetchPublic,
  };
}
