"use client";

import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { CACHE } from "@/lib/config/cache-config";

// Aliases for backward compat — update components to use useDataPrefetch instead
export { useDataPrefetch } from "./useDataPrefetch";

/**
 * Prefetch with 1 retry on failure.
 * Returns null on final failure (never throws).
 */
async function prefetchWithRetry(
  queryClient: QueryClient,
  options: Parameters<QueryClient["prefetchQuery"]>[0],
  label: string
): Promise<void> {
  try {
    await queryClient.prefetchQuery(options);
  } catch (e) {
    console.warn(`[prefetch] ${label} failed, retrying once...`, e);
    try {
      await queryClient.prefetchQuery(options);
    } catch (e2) {
      console.warn(`[prefetch] ${label} retry failed — skipping`, e2);
    }
  }
}

/**
 * Prefetch data for manufacturer page
 */
export async function prefetchManufacturerData(
  queryClient: QueryClient,
  account?: string
) {
  const tasks: Promise<void>[] = [
    prefetchWithRetry(queryClient, {
      queryKey: ["manufacturer", "transfer-requests"],
      queryFn: async () => {
        const res = await fetch("/api/manufacturer/transfer-request");
        return res.json();
      },
      staleTime: CACHE.PENDING_DATA.staleTime,
      gcTime: CACHE.PENDING_DATA.gcTime,
    }, "manufacturer transfer-requests"),
  ];

  if (account) {
    tasks.push(
      prefetchWithRetry(queryClient, {
        queryKey: ["manufacturer", "nfts", account],
        queryFn: async () => {
          const res = await fetch(`/api/manufacturer/nfts?address=${account}`);
          return res.json();
        },
        staleTime: CACHE.USER_DATA.staleTime,
        gcTime: CACHE.USER_DATA.gcTime,
      }, "manufacturer nfts")
    );
  }

  tasks.push(
    prefetchWithRetry(queryClient, {
      queryKey: ["manufacturer", "milestones"],
      queryFn: async () => {
        const res = await fetch("/api/manufacturer/milestone");
        return res.ok ? res.json() : { data: [], milestones: [] };
      },
      staleTime: CACHE.PENDING_DATA.staleTime,
      gcTime: CACHE.PENDING_DATA.gcTime,
    }, "manufacturer milestones")
  );

  // All prefetches run in parallel
  await Promise.all(tasks);
}

/**
 * Prefetch data for distributor page
 */
export async function prefetchDistributorData(
  queryClient: QueryClient,
  account?: string
) {
  const tasks: Promise<void>[] = [];

  if (account) {
    tasks.push(
      prefetchWithRetry(queryClient, {
        queryKey: ["distributor", "nfts", account],
        queryFn: async () => {
          const res = await fetch(`/api/distributor/nfts?address=${account}`);
          return res.json();
        },
        staleTime: CACHE.USER_DATA.staleTime,
        gcTime: CACHE.USER_DATA.gcTime,
      }, "distributor nfts"),
      prefetchWithRetry(queryClient, {
        queryKey: ["distributor", "transfer-requests", account],
        queryFn: async () => {
          const res = await fetch(
            `/api/manufacturer/transfer-request?distributor=${account}`
          );
          return res.json();
        },
        staleTime: CACHE.PENDING_DATA.staleTime,
        gcTime: CACHE.PENDING_DATA.gcTime,
      }, "distributor transfer-requests")
    );
  }

  tasks.push(
    prefetchWithRetry(queryClient, {
      queryKey: ["distributor", "all-nfts"],
      queryFn: async () => {
        const res = await fetch("/api/distributor/nfts");
        return res.json();
      },
      staleTime: CACHE.USER_DATA.staleTime,
      gcTime: CACHE.USER_DATA.gcTime,
    }, "distributor all-nfts")
  );

  await Promise.all(tasks);
}

/**
 * Prefetch data for admin page
 */
export async function prefetchAdminData(queryClient: QueryClient) {
  await Promise.all([
    prefetchWithRetry(queryClient, {
      queryKey: ["admin", "users"],
      queryFn: async () => {
        const res = await fetch("/api/admin/users", { credentials: "include" });
        return res.json();
      },
      staleTime: CACHE.ADMIN_DATA.staleTime,
      gcTime: CACHE.ADMIN_DATA.gcTime,
    }, "admin users"),
    prefetchWithRetry(queryClient, {
      queryKey: ["admin", "stats"],
      queryFn: async () => {
        const res = await fetch("/api/admin/stats?period=all", {
          credentials: "include",
        });
        return res.ok ? res.json() : { stats: {} };
      },
      staleTime: CACHE.ADMIN_DATA.staleTime,
      gcTime: CACHE.ADMIN_DATA.gcTime,
    }, "admin stats"),
  ]);
}

/**
 * Prefetch data for pharmacy page
 */
export async function prefetchPharmacyData(
  queryClient: QueryClient,
  account?: string
) {
  if (!account) return;

  await Promise.all([
    prefetchWithRetry(queryClient, {
      queryKey: ["pharmacy", "inventory", account],
      queryFn: async () => {
        const res = await fetch(`/api/pharmacy/inventory?address=${account}`);
        if (!res.ok) return { data: [], inventory: [] };
        const data = await res.json();
        return data.data?.inventory || data.data || [];
      },
      staleTime: CACHE.USER_DATA.staleTime,
      gcTime: CACHE.USER_DATA.gcTime,
    }, "pharmacy inventory"),
    prefetchWithRetry(queryClient, {
      queryKey: ["pharmacy", "pending-count", account],
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
    }, "pharmacy pending-count"),
  ]);
}

/**
 * Prefetch all role-based pages based on user role
 */
export async function prefetchForUserRole(
  queryClient: QueryClient,
  role: string | null,
  account?: string
) {
  if (!role) return;

  switch (role) {
    case "MANUFACTURER":
      await prefetchManufacturerData(queryClient, account);
      break;
    case "DISTRIBUTOR":
      await prefetchDistributorData(queryClient, account);
      break;
    case "PHARMACY":
      await prefetchPharmacyData(queryClient, account);
      break;
    case "ADMIN":
      // Run admin + manufacturer + distributor in parallel
      await Promise.all([
        prefetchAdminData(queryClient),
        prefetchManufacturerData(queryClient, account),
        prefetchDistributorData(queryClient, account),
      ]);
      break;
  }
}

/**
 * Hook wrapper for auto-prefetch
 */
export function useAutoPrefetch() {
  const queryClient = useQueryClient();
  return {
    prefetchForUserRole: (role: string | null, account?: string) =>
      prefetchForUserRole(queryClient, role, account),
  };
}
