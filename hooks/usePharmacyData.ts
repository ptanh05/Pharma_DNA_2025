"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS, CACHE } from "@/lib/config/cache-config";
import { fetchNFTs } from "@/hooks/useNFTDataBase";

export function usePharmacyInventory(address?: string, refreshKey?: number) {
  return useQuery({
    queryKey: ["pharmacy", "inventory", address, refreshKey ?? ""],
    queryFn: () =>
      fetchNFTs("/api/pharmacy/inventory", address, {
        responsePath: "data.inventory",
      }),
    enabled: !!address,
    staleTime: CACHE.USER_DATA.staleTime,
    gcTime: CACHE.USER_DATA.gcTime,
    refetchOnWindowFocus: false,
  });
}

export function usePendingTransferCount(address?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.pharmacy.pendingCount(address),
    queryFn: async () => {
      const res = await fetch(
        `/api/distributor/transfer-to-pharmacy?pharmacy_address=${address}&status=pending`
      );
      const data = await res.json();
      const requests = data.data || data;
      return Array.isArray(requests) ? requests.length : 0;
    },
    staleTime: CACHE.PENDING_DATA.staleTime,
    gcTime: CACHE.PENDING_DATA.gcTime,
    enabled: !!address,
    refetchOnWindowFocus: false,
  });
}

export function useInvalidatePharmacyData() {
  const queryClient = useQueryClient();

  const invalidateInventory = () => {
    queryClient.invalidateQueries({ queryKey: ["pharmacy", "inventory"] });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pharmacy.inventory() });
  };

  const invalidatePendingCount = () => {
    queryClient.invalidateQueries({ queryKey: ["pharmacy", "pending-count"] });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pharmacy.pendingCount() });
  };

  const invalidateAll = () => {
    invalidateInventory();
    invalidatePendingCount();
  };

  return { invalidateInventory, invalidatePendingCount, invalidateAll };
}