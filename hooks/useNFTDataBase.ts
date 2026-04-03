/**
 * Shared base hook for fetching NFT/Inventory data across roles.
 * Extracts common patterns: query setup, response parsing, cache config.
 */

import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { CACHE } from "@/lib/config/cache-config";

export interface NFT {
  id: string;
  batch_number: string;
  product_name?: string;
  name?: string;
  manufacturer_address: string;
  distributor_address?: string;
  pharmacy_address?: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

/**
 * Common fetch function used by role-specific hooks.
 * Handles address guard, fetch, and response normalization.
 */
export async function fetchNFTs<T = NFT>(
  apiPath: string,
  address: string | undefined,
  options?: {
    staleTime?: number;
    gcTime?: number;
    responsePath?: string; // dot-notation path to extract data, e.g. "data.nfts"
  }
): Promise<T[]> {
  if (!address) return [];
  const res = await fetch(`${apiPath}?address=${address}`);
  const data = await res.json();

  // Flexible response extraction: try nested paths first, then fall back to root
  let extracted = data;
  if (options?.responsePath) {
    const segments = options.responsePath.split(".");
    for (const seg of segments) {
      extracted = extracted?.[seg];
    }
  } else {
    // Default extraction hierarchy
    extracted = data?.data?.nfts ?? data?.data?.inventory ?? data?.data ?? data;
  }

  return Array.isArray(extracted) ? extracted : [];
}

/**
 * Base query options factory — used by role-specific hooks to build their useQuery.
 */
export function nftQueryOptions<T = NFT>(
  apiPath: string,
  address: string | undefined,
  queryKey: (address?: string) => readonly (string | undefined)[],
  options?: {
    staleTime?: number;
    gcTime?: number;
    responsePath?: string;
  }
): UseQueryOptions<T[], Error, T[], readonly (string | undefined)[]> {
  return {
    queryKey: queryKey(address),
    queryFn: () =>
      fetchNFTs<T>(apiPath, address, {
        staleTime: options?.staleTime ?? CACHE.USER_DATA.staleTime,
        gcTime: options?.gcTime ?? CACHE.USER_DATA.gcTime,
        responsePath: options?.responsePath,
      }),
    enabled: !!address,
    staleTime: options?.staleTime ?? CACHE.USER_DATA.staleTime,
    gcTime: options?.gcTime ?? CACHE.USER_DATA.gcTime,
    refetchOnWindowFocus: false,
  };
}
