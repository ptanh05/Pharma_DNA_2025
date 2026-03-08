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
      const res = await fetch(`/api/debug/nfts${params}`);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch NFTs");
      }
      return data.nfts || [];
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });
}
