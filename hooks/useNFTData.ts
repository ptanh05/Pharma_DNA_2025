"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS, CACHE } from "@/lib/config/cache-config";

// NOTE: These hooks were duplicated in useManufacturerData.ts and usePharmacyData.ts.
// Prefer using those specific hooks instead. These are kept for backward compat.

export function useManufacturerNFTs(address: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.manufacturer.nfts(address),
    queryFn: async () => {
      if (!address) return [];
      const res = await fetch(`/api/manufacturer/nfts?address=${address}`);
      const data = await res.json();
      const nfts = Array.isArray(data?.data?.nfts) ? data.data.nfts : [];
      return nfts;
    },
    enabled: !!address,
    staleTime: CACHE.USER_DATA.staleTime,
    gcTime: CACHE.USER_DATA.gcTime,
    refetchOnWindowFocus: false,
  });
}

export function useTransferRequests() {
  return useQuery({
    queryKey: QUERY_KEYS.manufacturer.transferRequests(),
    queryFn: async () => {
      const res = await fetch("/api/manufacturer/transfer-request");
      return res.json();
    },
    staleTime: CACHE.PENDING_DATA.staleTime,
    gcTime: CACHE.PENDING_DATA.gcTime,
    refetchOnWindowFocus: false,
    // REMOVED refetchInterval
  });
}

export function useApproveTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: number) => {
      const res = await fetch("/api/manufacturer/transfer-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action: "approve" }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.manufacturer.transferRequests(),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.manufacturer.nfts(),
      });
    },
  });
}

export function useDistributorNFTs(address: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.distributor.nfts(address),
    queryFn: async () => {
      if (!address) return [];
      const res = await fetch(`/api/distributor/nfts?address=${address}`);
      const data = await res.json();
      const nfts = Array.isArray(data?.data?.nfts) ? data.data.nfts : [];
      return nfts;
    },
    enabled: !!address,
    staleTime: CACHE.USER_DATA.staleTime,
    gcTime: CACHE.USER_DATA.gcTime,
    refetchOnWindowFocus: false,
  });
}

export function usePharmacyNFTs(address: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.pharmacy.nfts(address),
    queryFn: async () => {
      if (!address) return [];
      const res = await fetch(`/api/pharmacy/inventory?address=${address}`);
      const data = await res.json();
      const nfts = Array.isArray(data?.data?.nfts) ? data.data.nfts : [];
      return nfts;
    },
    enabled: !!address,
    staleTime: CACHE.USER_DATA.staleTime,
    gcTime: CACHE.USER_DATA.gcTime,
    refetchOnWindowFocus: false,
  });
}

export function useDistributorTransfers(address: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.distributor.transfers(address),
    queryFn: async () => {
      if (!address) return [];
      const res = await fetch(`/api/distributor/nfts?address=${address}&transfers=true`);
      const data = await res.json();
      return data.data?.transfers || [];
    },
    enabled: !!address,
    staleTime: CACHE.PENDING_DATA.staleTime,
    gcTime: CACHE.PENDING_DATA.gcTime,
    refetchOnWindowFocus: false,
    // REMOVED refetchInterval
  });
}

export function usePharmacyTransfers(address: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.pharmacy.transfers(address),
    queryFn: async () => {
      if (!address) return [];
      const res = await fetch(`/api/pharmacy/inventory?address=${address}&transfers=true`);
      const data = await res.json();
      return data.data?.transfers || [];
    },
    enabled: !!address,
    staleTime: CACHE.PENDING_DATA.staleTime,
    gcTime: CACHE.PENDING_DATA.gcTime,
    refetchOnWindowFocus: false,
    // REMOVED refetchInterval
  });
}
