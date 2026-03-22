"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

const DEFAULT_STALE_TIME = 10 * 60 * 1000; // 10 minutes

/**
 * Hook for fetching pharmacy inventory
 */
export function usePharmacyInventory(address?: string, refreshKey?: number) {
  return useQuery({
    queryKey: ["pharmacy", "inventory", address, refreshKey],
    queryFn: async () => {
      const res = await fetch(`/api/pharmacy/inventory?address=${address || ''}`);
      const data = await res.json();
      const inventory = data?.data?.inventory ?? data?.data ?? data;
      return Array.isArray(inventory) ? inventory : [];
    },
    staleTime: DEFAULT_STALE_TIME,
    enabled: !!address,
  });
}

/**
 * Hook for fetching pending transfer count
 * Uses refetchInterval instead of setInterval for better cache management
 */
export function usePendingTransferCount(address?: string) {
  return useQuery({
    queryKey: ["pharmacy", "pending-count", address],
    queryFn: async () => {
      const res = await fetch(
        `/api/distributor/transfer-to-pharmacy?pharmacy_address=${address}&status=pending`
      );
      const data = await res.json();
      const requests = data.data || data;
      return Array.isArray(requests) ? requests.length : 0;
    },
    staleTime: 30 * 1000, // 30 seconds - data changes frequently
    refetchInterval: 30 * 1000, // Auto-refresh every 30s
    enabled: !!address,
  });
}

/**
 * Hook to invalidate pharmacy data
 */
export function useInvalidatePharmacyData() {
  const queryClient = useQueryClient();

  const invalidateInventory = () => {
    queryClient.invalidateQueries({
      queryKey: ["pharmacy", "inventory"],
    });
  };

  const invalidatePendingCount = () => {
    queryClient.invalidateQueries({
      queryKey: ["pharmacy", "pending-count"],
    });
  };

  const invalidateAll = () => {
    invalidateInventory();
    invalidatePendingCount();
  };

  return { invalidateInventory, invalidatePendingCount, invalidateAll };
}
