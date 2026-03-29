"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS, CACHE } from "@/lib/config/cache-config";

export function useProductLookup(code: string) {
  return useQuery({
    queryKey: QUERY_KEYS.public.lookup(code),
    queryFn: async () => {
      if (!code || code.length < 3) return null;
      const res = await fetch(`/api/public/lookup?code=${encodeURIComponent(code)}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: code.length >= 3,
    staleTime: CACHE.PUBLIC_DATA.staleTime,
    gcTime: CACHE.PUBLIC_DATA.gcTime,
    refetchOnWindowFocus: false,
  });
}

export function usePublicLookup(code: string) {
  return useQuery({
    queryKey: QUERY_KEYS.public.lookup(code),
    queryFn: async () => {
      if (!code || code.length < 3) return null;
      const res = await fetch(`/api/public/lookup?code=${encodeURIComponent(code)}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: code.length >= 3,
    staleTime: CACHE.PUBLIC_DATA.staleTime,
    gcTime: CACHE.PUBLIC_DATA.gcTime,
    refetchOnWindowFocus: false,
  });
}

export function useNFTInfo(nftId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.nft.info(nftId),
    queryFn: async () => {
      if (!nftId) return null;
      const res = await fetch(`/api/public/product?nftId=${encodeURIComponent(nftId)}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!nftId,
    staleTime: CACHE.PUBLIC_DATA.staleTime,
    gcTime: CACHE.PUBLIC_DATA.gcTime,
    refetchOnWindowFocus: false,
  });
}

export function useExpiryCheck(nftId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.public.checkExpiry(nftId),
    queryFn: async () => {
      if (!nftId) return null;
      const res = await fetch(`/api/public/check-expiry?nftId=${encodeURIComponent(nftId)}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!nftId,
    staleTime: CACHE.PUBLIC_DATA.staleTime,
    gcTime: CACHE.PUBLIC_DATA.gcTime,
    refetchOnWindowFocus: false,
  });
}
