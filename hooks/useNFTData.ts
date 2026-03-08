"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Hook lấy danh sách NFT của manufacturer
 */
export function useManufacturerNFTs(address: string | undefined) {
  return useQuery({
    queryKey: ["manufacturer", "nfts", address],
    queryFn: async () => {
      if (!address) return [];
      const res = await fetch(`/api/manufacturer/nfts?address=${address}`);
      const data = await res.json();
      if (data.success && data.data?.nfts) {
        return data.data.nfts;
      }
      return [];
    },
    enabled: !!address,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook lấy danh sách yêu cầu chuyển giao (manufacturer)
 */
export function useTransferRequests() {
  return useQuery({
    queryKey: ["manufacturer", "transfer-requests"],
    queryFn: async () => {
      const res = await fetch("/api/manufacturer/transfer-request");
      return res.json();
    },
    staleTime: 15 * 1000, // 15 seconds
    gcTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 30 * 1000, // Poll every 30 seconds
  });
}

/**
 * Hook duyệt yêu cầu chuyển giao
 */
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
      queryClient.invalidateQueries({ queryKey: ["manufacturer", "transfer-requests"] });
      queryClient.invalidateQueries({ queryKey: ["manufacturer", "nfts"] });
    },
  });
}

/**
 * Hook lấy danh sách NFT của distributor
 */
export function useDistributorNFTs(address: string | undefined) {
  return useQuery({
    queryKey: ["distributor", "nfts", address],
    queryFn: async () => {
      if (!address) return [];
      const res = await fetch(`/api/distributor/nfts?address=${address}`);
      const data = await res.json();
      if (data.success && data.data?.nfts) {
        return data.data.nfts;
      }
      return [];
    },
    enabled: !!address,
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
  });
}

/**
 * Hook lấy danh sách NFT của pharmacy
 */
export function usePharmacyNFTs(address: string | undefined) {
  return useQuery({
    queryKey: ["pharmacy", "nfts", address],
    queryFn: async () => {
      if (!address) return [];
      const res = await fetch(`/api/pharmacy/inventory?address=${address}`);
      const data = await res.json();
      if (data.success && data.data?.nfts) {
        return data.data.nfts;
      }
      return [];
    },
    enabled: !!address,
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
  });
}

/**
 * Hook lấy danh sách transfer requests cho distributor
 */
export function useDistributorTransfers(address: string | undefined) {
  return useQuery({
    queryKey: ["distributor", "transfers", address],
    queryFn: async () => {
      if (!address) return [];
      const res = await fetch(`/api/distributor/nfts?address=${address}&transfers=true`);
      const data = await res.json();
      return data.data?.transfers || [];
    },
    enabled: !!address,
    staleTime: 15 * 1000,
    gcTime: 1 * 60 * 1000,
    refetchInterval: 30 * 1000,
  });
}

/**
 * Hook lấy danh sách transfer requests cho pharmacy
 */
export function usePharmacyTransfers(address: string | undefined) {
  return useQuery({
    queryKey: ["pharmacy", "transfers", address],
    queryFn: async () => {
      if (!address) return [];
      const res = await fetch(`/api/pharmacy/inventory?address=${address}&transfers=true`);
      const data = await res.json();
      return data.data?.transfers || [];
    },
    enabled: !!address,
    staleTime: 15 * 1000,
    gcTime: 1 * 60 * 1000,
    refetchInterval: 30 * 1000,
  });
}
