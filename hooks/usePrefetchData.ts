"use client";

import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";

const DEFAULT_STALE_TIME = 10 * 60 * 1000; // 10 phút

/**
 * Hook for fetching distributor NFTs
 */
export function useDistributorNFTs(address?: string) {
  return useQuery({
    queryKey: ["distributor", "nfts", address],
    queryFn: async () => {
      const res = await fetch(`/api/distributor/nfts?address=${address || ''}`);
      const data = await res.json();
      return data.success ? data.data?.nfts || [] : [];
    },
    staleTime: DEFAULT_STALE_TIME,
    enabled: !!address,
  });
}

/**
 * Hook to invalidate distributor data
 */
export function useInvalidateDistributorData() {
  const queryClient = useQueryClient();

  const invalidateDistributorNFTs = () => {
    queryClient.invalidateQueries({
      queryKey: ["distributor", "nfts"],
    });
  };

  return { invalidateDistributorNFTs };
}

/**
 * Prefetch data for manufacturer page
 */
export async function prefetchManufacturerData(queryClient: QueryClient, account?: string) {
  try {
    // Prefetch transfer requests
    await queryClient.prefetchQuery({
      queryKey: ["manufacturer", "transfer-requests"],
      queryFn: async () => {
        const res = await fetch("/api/manufacturer/transfer-request");
        return res.json();
      },
      staleTime: DEFAULT_STALE_TIME,
    });

    // Prefetch NFTs if account is available
    if (account) {
      await queryClient.prefetchQuery({
        queryKey: ["manufacturer", "nfts", account],
        queryFn: async () => {
          const res = await fetch(`/api/manufacturer/nfts?address=${account}`);
          return res.json();
        },
        staleTime: DEFAULT_STALE_TIME,
      });
    }

    // Prefetch milestones
    await queryClient.prefetchQuery({
      queryKey: ["manufacturer", "milestones"],
      queryFn: async () => {
        const res = await fetch("/api/manufacturer/milestone");
        return res.json();
      },
      staleTime: DEFAULT_STALE_TIME,
    });

    console.log("[Prefetch] Manufacturer data prefetched");
  } catch (error) {
    console.error("[Prefetch] Error prefetching manufacturer data:", error);
  }
}

/**
 * Prefetch data for distributor page
 */
export async function prefetchDistributorData(queryClient: QueryClient, account?: string) {
  try {
    if (account) {
      // Prefetch NFTs for distributor
      await queryClient.prefetchQuery({
        queryKey: ["distributor", "nfts", account],
        queryFn: async () => {
          const res = await fetch(`/api/distributor/nfts?address=${account}`);
          return res.json();
        },
        staleTime: DEFAULT_STALE_TIME,
      });

      // Prefetch transfer requests for this distributor
      await queryClient.prefetchQuery({
        queryKey: ["distributor", "transfer-requests", account],
        queryFn: async () => {
          const res = await fetch(`/api/manufacturer/transfer-request?distributor=${account}`);
          return res.json();
        },
        staleTime: DEFAULT_STALE_TIME,
      });
    }

    // Prefetch all NFTs (for selection)
    await queryClient.prefetchQuery({
      queryKey: ["distributor", "all-nfts"],
      queryFn: async () => {
        const res = await fetch("/api/distributor/nfts");
        return res.json();
      },
      staleTime: DEFAULT_STALE_TIME,
    });

    console.log("[Prefetch] Distributor data prefetched");
  } catch (error) {
    console.error("[Prefetch] Error prefetching distributor data:", error);
  }
}

/**
 * Prefetch data for admin page
 */
export async function prefetchAdminData(queryClient: QueryClient) {
  try {
    // Prefetch users
    await queryClient.prefetchQuery({
      queryKey: ["admin", "users"],
      queryFn: async () => {
        const res = await fetch("/api/admin/users");
        return res.json();
      },
      staleTime: DEFAULT_STALE_TIME,
    });

    // Prefetch stats
    await queryClient.prefetchQuery({
      queryKey: ["admin", "stats"],
      queryFn: async () => {
        const res = await fetch("/api/admin/stats");
        return res.json();
      },
      staleTime: DEFAULT_STALE_TIME,
    });

    console.log("[Prefetch] Admin data prefetched");
  } catch (error) {
    console.error("[Prefetch] Error prefetching admin data:", error);
  }
}

/**
 * Prefetch data for pharmacy page
 */
export async function prefetchPharmacyData(queryClient: QueryClient, account?: string) {
  try {
    if (account) {
      await queryClient.prefetchQuery({
        queryKey: ["pharmacy", "nfts", account],
        queryFn: async () => {
          const res = await fetch(`/api/pharmacy/nfts?address=${account}`);
          return res.json();
        },
        staleTime: DEFAULT_STALE_TIME,
      });
    }

    // Prefetch all NFTs for pharmacy lookup
    await queryClient.prefetchQuery({
      queryKey: ["pharmacy", "all-nfts"],
      queryFn: async () => {
        const res = await fetch("/api/pharmacy/nfts");
        return res.json();
      },
      staleTime: DEFAULT_STALE_TIME,
    });

    console.log("[Prefetch] Pharmacy data prefetched");
  } catch (error) {
    console.error("[Prefetch] Error prefetching pharmacy data:", error);
  }
}

/**
 * Prefetch all role-based pages based on user role
 * Call this after user connects wallet
 */
export async function prefetchForUserRole(
  queryClient: QueryClient,
  role: string | null,
  account?: string
) {
  if (!role) return;

  console.log("[Prefetch] Prefetching for role:", role);

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
 * Prefetch tất cả data khi user đã login
 * Gọi hook này ở landing page sau khi user connect wallet
 */
export function useAutoPrefetch() {
  const queryClient = useQueryClient();

  return { prefetchForUserRole: (role: string | null, account?: string) => prefetchForUserRole(queryClient, role, account) };
}
