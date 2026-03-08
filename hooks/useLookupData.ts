"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Hook tra cứu sản phẩm theo mã
 */
export function useProductLookup(code: string) {
  return useQuery({
    queryKey: ["lookup", "product", code],
    queryFn: async () => {
      if (!code || code.length < 3) return null;
      const res = await fetch(`/api/lookup?code=${encodeURIComponent(code)}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: code.length >= 3,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook tra cứu công khai (public lookup)
 */
export function usePublicLookup(code: string) {
  return useQuery({
    queryKey: ["public", "lookup", code],
    queryFn: async () => {
      if (!code || code.length < 3) return null;
      const res = await fetch(`/api/public/lookup?code=${encodeURIComponent(code)}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: code.length >= 3,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Hook tra cứu thông tin sản phẩm (có caching)
 */
export function useNFTInfo(nftId: string) {
  return useQuery({
    queryKey: ["nft", "info", nftId],
    queryFn: async () => {
      if (!nftId) return null;
      const res = await fetch(`/api/public/product?nftId=${encodeURIComponent(nftId)}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!nftId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook kiểm tra hết hạn sản phẩm
 */
export function useExpiryCheck(nftId: string) {
  return useQuery({
    queryKey: ["nft", "expiry", nftId],
    queryFn: async () => {
      if (!nftId) return null;
      const res = await fetch(`/api/public/check-expiry?nftId=${encodeURIComponent(nftId)}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!nftId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
