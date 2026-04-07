"use client";

import { useQuery } from "@tanstack/react-query";

export interface NFT {
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

export interface NFTsResponse {
  nfts: NFT[];
  total: number;
  page: number;
  limit: number;
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
    staleTime: 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: 1000,
  });
}

export function useNFTsPaginated(page: number = 1, limit: number = 10, address?: string) {
  return useQuery<NFTsResponse>({
    queryKey: ["nfts-paginated", page, limit, address],
    queryFn: async () => {
      let url = `/api/admin/nfts?page=${page}&limit=${limit}`;
      if (address) url += `&address=${address}`;
      const res = await fetch(url, { credentials: "include" });

      if (!res.ok) {
        console.warn(`[/api/admin/nfts] HTTP ${res.status}`);
        return { nfts: [], total: 0, page, limit };
      }

      const data = await res.json();
      return {
        nfts: Array.isArray(data?.nfts) ? data.nfts : [],
        total: parseInt(data?.total || "0", 10),
        page: parseInt(data?.page || "1", 10),
        limit: parseInt(data?.limit || String(limit), 10),
      };
    },
    staleTime: 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: 1000,
  });
}
