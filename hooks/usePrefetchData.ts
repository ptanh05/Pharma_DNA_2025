"use client";

import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { CACHE } from "@/lib/config/cache-config";

// Aliases for backward compat — update components to use useDataPrefetch instead
export { useDataPrefetch } from "./useDataPrefetch";

/**
 * Prefetch data for manufacturer page
 */
export async function prefetchManufacturerData(
  queryClient: QueryClient,
  account?: string
) {
  try {
    await queryClient.prefetchQuery({
      queryKey: ["manufacturer", "transfer-requests"],
      queryFn: async () => {
        const res = await fetch("/api/manufacturer/transfer-request");
        return res.json();
      },
      staleTime: CACHE.PENDING_DATA.staleTime,
      gcTime: CACHE.PENDING_DATA.gcTime,
    });

    if (account) {
      await queryClient.prefetchQuery({
        queryKey: ["manufacturer", "nfts", account],
        queryFn: async () => {
          const res = await fetch(`/api/manufacturer/nfts?address=${account}`);
          return res.json();
        },
        staleTime: CACHE.USER_DATA.staleTime,
        gcTime: CACHE.USER_DATA.gcTime,
      });
    }

    await queryClient.prefetchQuery({
      queryKey: ["manufacturer", "milestones"],
      queryFn: async () => {
        const adminToken =
          typeof window !== "undefined"
            ? localStorage.getItem("admin_token")
            : null;
        const res = await fetch("/api/manufacturer/milestone", {
          headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
        });
        return res.ok ? res.json() : { data: [], milestones: [] };
      },
      staleTime: CACHE.PENDING_DATA.staleTime,
      gcTime: CACHE.PENDING_DATA.gcTime,
    });
  } catch (e) {
    // Silent fail
  }
}

/**
 * Prefetch data for distributor page
 */
export async function prefetchDistributorData(
  queryClient: QueryClient,
  account?: string
) {
  try {
    if (account) {
      await queryClient.prefetchQuery({
        queryKey: ["distributor", "nfts", account],
        queryFn: async () => {
          const res = await fetch(`/api/distributor/nfts?address=${account}`);
          return res.json();
        },
        staleTime: CACHE.USER_DATA.staleTime,
        gcTime: CACHE.USER_DATA.gcTime,
      });

      await queryClient.prefetchQuery({
        queryKey: ["distributor", "transfer-requests", account],
        queryFn: async () => {
          const res = await fetch(
            `/api/manufacturer/transfer-request?distributor=${account}`
          );
          return res.json();
        },
        staleTime: CACHE.PENDING_DATA.staleTime,
        gcTime: CACHE.PENDING_DATA.gcTime,
      });
    }

    await queryClient.prefetchQuery({
      queryKey: ["distributor", "all-nfts"],
      queryFn: async () => {
        const res = await fetch("/api/distributor/nfts");
        return res.json();
      },
      staleTime: CACHE.USER_DATA.staleTime,
      gcTime: CACHE.USER_DATA.gcTime,
    });
  } catch (e) {
    // Silent fail
  }
}

/**
 * Prefetch data for admin page
 */
export async function prefetchAdminData(queryClient: QueryClient) {
  try {
    await queryClient.prefetchQuery({
      queryKey: ["admin", "users"],
      queryFn: async () => {
        const res = await fetch("/api/admin/users", { credentials: "include" });
        return res.json();
      },
      staleTime: CACHE.ADMIN_DATA.staleTime,
      gcTime: CACHE.ADMIN_DATA.gcTime,
    });

    const adminToken =
      typeof window !== "undefined"
        ? localStorage.getItem("admin_token")
        : null;
    if (adminToken) {
      await queryClient.prefetchQuery({
        queryKey: ["admin", "stats"],
        queryFn: async () => {
          const res = await fetch("/api/admin/stats?period=all", {
            headers: { Authorization: `Bearer ${adminToken}` },
            credentials: "include",
          });
          return res.ok ? res.json() : { stats: {} };
        },
        staleTime: CACHE.ADMIN_DATA.staleTime,
        gcTime: CACHE.ADMIN_DATA.gcTime,
      });
    }
  } catch (e) {
    // Silent fail
  }
}

/**
 * Prefetch data for pharmacy page
 */
export async function prefetchPharmacyData(
  queryClient: QueryClient,
  account?: string
) {
  try {
    if (!account) return;

    await queryClient.prefetchQuery({
      queryKey: ["pharmacy", "inventory", account],
      queryFn: async () => {
        const res = await fetch(`/api/pharmacy/inventory?address=${account}`);
        if (!res.ok) return { data: [], inventory: [] };
        const data = await res.json();
        return data.data?.inventory || data.data || [];
      },
      staleTime: CACHE.USER_DATA.staleTime,
      gcTime: CACHE.USER_DATA.gcTime,
    });

    await queryClient.prefetchQuery({
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
    });
  } catch (e) {
    // Silent fail
  }
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
      await prefetchAdminData(queryClient);
      await prefetchManufacturerData(queryClient, account);
      await prefetchDistributorData(queryClient, account);
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
