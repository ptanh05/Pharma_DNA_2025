"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS, CACHE } from "@/lib/config/cache-config";
import { fetchNFTs } from "@/hooks/useNFTDataBase";

interface TransferRequest {
  id: number;
  nft_id: number;
  distributor_address: string;
  pharmacy_address: string | null;
  transfer_note: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
  updated_at?: string;
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
    refetchOnWindowFocus: false,
  });
}

export function useManufacturerNFTs(address?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.manufacturer.nfts(address),
    queryFn: () =>
      fetchNFTs("/api/manufacturer/nfts", address, {
        responsePath: "data.nfts",
      }),
    enabled: !!address,
    staleTime: CACHE.USER_DATA.staleTime,
    gcTime: CACHE.USER_DATA.gcTime,
    refetchOnWindowFocus: false,
  });
}

export function useInvalidateManufacturerData() {
  const queryClient = useQueryClient();

  const invalidateTransferRequests = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.manufacturer.transferRequests() });
  };

  const invalidateNFTs = () => {
    queryClient.invalidateQueries({ queryKey: ["manufacturer", "nfts"] });
  };

  return {
    invalidateTransferRequests,
    invalidateNFTs,
  };
}