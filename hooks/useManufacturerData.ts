"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS, CACHE } from "@/lib/config/cache-config";
import { fetchNFTs } from "@/hooks/useNFTDataBase";
import { logger } from "@/lib/utils/logger";

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

export function useManufacturerTransferRequests(manufacturerAddress?: string) {
  return useQuery<TransferRequest[]>({
    queryKey: QUERY_KEYS.manufacturer.transferRequests(manufacturerAddress),
    queryFn: async () => {
      const url = manufacturerAddress
        ? `/api/manufacturer/transfer-request?manufacturer_address=${encodeURIComponent(manufacturerAddress)}`
        : `/api/manufacturer/transfer-request`;
      const res = await fetch(url);
      if (!res.ok) {
        logger.error('USE_MANUFACTURER_DATA', 'API error fetching transfer requests', { status: res.status, text: await res.text() });
        return [];
      }
      const data = await res.json();
      const requests = data?.data ?? data;
      logger.debug('USE_MANUFACTURER_DATA', 'Fetched requests', { count: Array.isArray(requests) ? requests.length : 0 });
      return Array.isArray(requests) ? requests : [];
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
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
    // Invalidate all transfer request caches (with any address)
    queryClient.invalidateQueries({ queryKey: ['manufacturer', 'transfer-requests'] });
  };

  const invalidateNFTs = () => {
    queryClient.invalidateQueries({ queryKey: ["manufacturer", "nfts"] });
  };

  return {
    invalidateTransferRequests,
    invalidateNFTs,
  };
}