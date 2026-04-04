"use client";

import { useQuery } from "@tanstack/react-query";

interface NFT {
  id: string;
  batch_number: string;
  product_name: string;
  manufacturer_address: string;
  distributor_address?: string;
  pharmacy_address?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useNFTs(address?: string) {
  return useQuery<NFT[]>({
    queryKey: ["nfts", address],
    queryFn: async () => {
      const params = address ? `?address=${address}` : "";
      const res = await fetch(`/api/admin/nfts${params}`, { credentials: "include" });

      if (!res.ok) {
        console.warn(`[/api/admin/nfts] HTTP ${res.status}`);
        return [];
      }

      const data = await res.json();
      // Handle various response formats
      const nfts = data?.nfts ?? data?.data?.nfts ?? data?.data ?? [];
      return Array.isArray(nfts) ? nfts : [];
    },
    staleTime: 30000,
    refetchInterval: 30000,
    retry: 2,
    retryDelay: 1000,
  });
}
