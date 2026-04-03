"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS, CACHE } from "@/lib/config/cache-config";

// ============ Types ============

export interface Registration {
  id: number;
  wallet_address: string;
  requested_role: "MANUFACTURER" | "DISTRIBUTOR" | "PHARMACY";
  company_name?: string;
  license_number?: string;
  license_ipfs_hash?: string;
  tax_id?: string;
  distributor_name?: string;
  distributor_address?: string;
  pharmacy_name?: string;
  pharmacy_address?: string;
  contact_email?: string;
  contact_phone?: string;
  notes?: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  blockchain_tx?: string;
  created_at: string;
}

export interface RegistrationFilters {
  status?: "pending" | "approved" | "rejected";
  page?: number;
  limit?: number;
}

// ============ Query Keys ============

export const QUERY_KEYS_REGISTRATIONS = {
  all: ["registrations"] as const,
  list: (filters: RegistrationFilters) => [...QUERY_KEYS_REGISTRATIONS.all, "list", filters] as const,
};

// ============ Submit Registration (public) ============

export function useSubmitRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      walletAddress: string;
      requestedRole: string;
      contactEmail?: string;
      contactPhone?: string;
      notes?: string;
      // Manufacturer
      companyName?: string;
      licenseNumber?: string;
      taxId?: string;
      licenseIpfsHash?: string;
      // Distributor
      distributorName?: string;
      distributorAddress?: string;
      // Pharmacy
      pharmacyName?: string;
      pharmacyAddress?: string;
    }) => {
      const res = await fetch("/api/registrations/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || json.error || "Gửi đơn thất bại");
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS_REGISTRATIONS.all });
    },
  });
}

// ============ List Registrations (admin) ============

export function useRegistrations(filters: RegistrationFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  params.set("page", String(filters.page ?? 1));
  params.set("limit", String(filters.limit ?? 10));

  const adminToken =
    typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;

  return useQuery({
    queryKey: QUERY_KEYS_REGISTRATIONS.list(filters),
    queryFn: async () => {
      const res = await fetch(`/api/registrations?${params.toString()}`, {
        headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Không thể tải danh sách đơn");
      }
      return data as {
        data: Registration[];
        total: number;
        page: number;
        limit: number;
      };
    },
    staleTime: 0,
    gcTime: CACHE.ADMIN_DATA.gcTime,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

// ============ Review Registration (admin) ============

export function useReviewRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      rejectionReason,
    }: {
      id: number;
      status: "approved" | "rejected";
      rejectionReason?: string;
    }) => {
      const adminToken =
        typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;

      const res = await fetch(`/api/registrations/${id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
        },
        body: JSON.stringify({ status, rejectionReason }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Duyệt đơn thất bại");
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS_REGISTRATIONS.all });
    },
  });
}
