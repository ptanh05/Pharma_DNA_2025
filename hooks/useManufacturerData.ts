"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS, CACHE } from "@/lib/config/cache-config";

interface TransferRequest {
  id: string;
  nft_id: string;
  batch_number: string;
  product_name: string;
  from_address: string;
  to_address: string;
  status: string;
  created_at: string;
}

interface NFT {
  id: string;
  batch_number: string;
  product_name: string;
  manufacturer_address: string;
  status: string;
  created_at: string;
}

export function useManufacturerTransferRequests() {
  return useQuery<TransferRequest[]>({
    queryKey: QUERY_KEYS.manufacturer.transferRequests(),
    queryFn: async () => {
      const res = await fetch("/api/manufacturer/transfer-request");
      const data = await res.json();
      const requests = data?.data ?? data;
      return Array.isArray(requests) ? requests : [];
    },
    staleTime: CACHE.PENDING_DATA.staleTime,
    gcTime: CACHE.PENDING_DATA.gcTime,
    // REMOVED refetchInterval — mutations handle refresh
    // Keeping it causes unnecessary API spam on background tabs
    refetchOnWindowFocus: false,
  });
}

export function useManufacturerNFTs(address?: string) {
  return useQuery<NFT[]>({
    queryKey: QUERY_KEYS.manufacturer.nfts(address),
    queryFn: async () => {
      const res = await fetch(`/api/manufacturer/nfts?address=${address || ''}`);
      const data = await res.json();
      const nfts = data?.data?.nfts ?? data?.data ?? data;
      return Array.isArray(nfts) ? nfts : [];
    },
    staleTime: CACHE.USER_DATA.staleTime,
    gcTime: CACHE.USER_DATA.gcTime,
    enabled: !!address,
    refetchOnWindowFocus: false,
  });
}

export function useInvalidateManufacturerData() {
  const queryClient = useQueryClient();

  const invalidateTransferRequests = () => {
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.manufacturer.transferRequests(),
    });
  };

  const invalidateNFTs = () => {
    queryClient.invalidateQueries({
      queryKey: ["manufacturer", "nfts"], // Keep legacy key for backward compat
    });
    // Also invalidate with canonical key
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.manufacturer.nfts(),
    });
  };

  return { invalidateTransferRequests, invalidateNFTs };
}
