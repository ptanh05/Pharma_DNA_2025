'use client';

import { useQuery } from '@tanstack/react-query';

export interface SupplyChainFunnelData {
  minted: number;
  at_distributor: number;
  at_pharmacy: number;
  dispensed: number;
  total: number;
}

export function useAnalyticsFunnel() {
  return useQuery<{ success: boolean; data: SupplyChainFunnelData }>({
    queryKey: ['analytics', 'funnel'],
    queryFn: () => fetch('/api/analytics/funnel').then((r) => r.json()),
    staleTime: 30_000,
    retry: 2,
  });
}