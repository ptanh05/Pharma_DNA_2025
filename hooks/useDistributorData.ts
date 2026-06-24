"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Fetch distributor NFT inventory using React Query.
 * Replaces raw useEffect + fetch in distributor page.
 */
export function useDistributorNFTs(address?: string) {
  return useQuery({
    queryKey: ["distributor", "nfts", address],
    queryFn: async () => {
      const params = address ? `?address=${address}` : "";
      const res = await fetch(`/api/distributor/nfts${params}`);
      const data = await res.json();
      // API returns { success, data: { nfts, total, page, limit } }
      if (!data.success || !data.data || !data.data.nfts) return [];
      return data.data.nfts;
    },
    enabled: !!address,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Fetch distributor transfer requests using React Query.
 */
export function useDistributorTransferRequests(address?: string) {
  return useQuery({
    queryKey: ["distributor", "transfer-requests", address],
    queryFn: async () => {
      const res = await fetch(`/api/manufacturer/transfer-request?distributor=${address}`);
      const data = await res.json();
      return data?.data || [];
    },
    enabled: !!address,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Confirm receipt of NFT — wraps the POST + auto-invalidates NFT list.
 */
export function useConfirmReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nftId, distributorAddress }: { nftId: number; distributorAddress: string }) => {
      const res = await fetch("/api/distributor/confirm-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nftId, distributorAddress }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Xác nhận thất bại");
      return data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["distributor", "nfts", vars.distributorAddress] });
      queryClient.invalidateQueries({ queryKey: ["distributor", "transfer-requests", vars.distributorAddress] });
    },
  });
}

/**
 * Fetch milestones for a specific NFT.
 */
export function useMilestones(nftId?: string | number) {
  return useQuery({
    queryKey: ["milestones", nftId],
    queryFn: async () => {
      const res = await fetch(`/api/manufacturer/milestone?nft_id=${nftId}`);
      const data = await res.json();
      return data?.data || [];
    },
    enabled: !!nftId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });
}
