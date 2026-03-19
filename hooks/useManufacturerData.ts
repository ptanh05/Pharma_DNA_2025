"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

const DEFAULT_STALE_TIME = 10 * 60 * 1000; // 10 phút

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

/**
 * Hook to fetch manufacturer transfer requests
 */
export function useManufacturerTransferRequests() {
  return useQuery<TransferRequest[]>({
    queryKey: ["manufacturer", "transfer-requests"],
    queryFn: async () => {
      const res = await fetch("/api/manufacturer/transfer-request");
      const data = await res.json();
      return data || [];
    },
    staleTime: DEFAULT_STALE_TIME,
    refetchInterval: 60000, // Refetch every minute (chỉ khi tab active)
  });
}

/**
 * Hook to fetch manufacturer NFTs
 */
export function useManufacturerNFTs(address?: string) {
  return useQuery<NFT[]>({
    queryKey: ["manufacturer", "nfts", address],
    queryFn: async () => {
      const res = await fetch(`/api/manufacturer/nfts?address=${address || ''}`);
      const data = await res.json();
      return data.success ? data.data?.nfts || [] : [];
    },
    staleTime: DEFAULT_STALE_TIME,
    enabled: !!address,
  });
}

/**
 * Hook to invalidate manufacturer data
 * Call this after mutations (approve, reject, etc.)
 */
export function useInvalidateManufacturerData() {
  const queryClient = useQueryClient();

  const invalidateTransferRequests = () => {
    queryClient.invalidateQueries({
      queryKey: ["manufacturer", "transfer-requests"],
    });
  };

  const invalidateNFTs = () => {
    queryClient.invalidateQueries({
      queryKey: ["manufacturer", "nfts"],
    });
  };

  return { invalidateTransferRequests, invalidateNFTs };
}
