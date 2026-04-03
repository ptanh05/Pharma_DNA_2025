"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS, CACHE } from "@/lib/config/cache-config";

interface User {
  address: string;
  role: string;
  assigned_at: string;
  formattedAddress?: string;
  assignedAt?: string;
}

interface AdminStats {
  totalNFTs?: number;
  totalUsers: number;
  manufacturers: number;
  distributors: number;
  pharmacies: number;
  admins: number;
}

export function useUsers() {
  return useQuery<User[]>({
    queryKey: QUERY_KEYS.admin.users(),
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      const users = data?.data?.users ?? data?.data ?? data?.users ?? data;
      if (!Array.isArray(users)) {
        console.warn("[useUsers] API returned non-array, returning empty array");
        return [];
      }
      return users;
    },
    staleTime: CACHE.ADMIN_DATA.staleTime,
    gcTime: CACHE.ADMIN_DATA.gcTime,
    refetchOnWindowFocus: false,
  });
}

export function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: QUERY_KEYS.admin.stats(),
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      const users: User[] = data?.data?.users ?? data?.data ?? data?.users ?? [];

      let totalNFTs = 0;
      const adminToken =
        typeof window !== "undefined"
          ? localStorage.getItem("admin_token")
          : null;
      if (adminToken) {
        try {
          const dashboardRes = await fetch("/api/admin/stats?period=all", {
            headers: { Authorization: `Bearer ${adminToken}` },
          });
          if (dashboardRes.ok) {
            const dashboardData = await dashboardRes.json();
            totalNFTs = parseInt(dashboardData?.data?.nft?.total_nfts || "0");
          }
        } catch {
          // Silently ignore
        }
      }

      return {
        totalNFTs,
        totalUsers: users.length,
        manufacturers: users.filter((u) => u.role === "MANUFACTURER").length,
        distributors: users.filter((u) => u.role === "DISTRIBUTOR").length,
        pharmacies: users.filter((u) => u.role === "PHARMACY").length,
        admins: users.filter((u) => u.role === "ADMIN").length,
      };
    },
    staleTime: CACHE.ADMIN_DATA.staleTime,
    gcTime: CACHE.ADMIN_DATA.gcTime,
    refetchOnWindowFocus: false,
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      address,
      role,
    }: {
      address: string;
      role: string;
    }) => {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.error || "Lỗi khi cấp quyền");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admin.users() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admin.stats() });
    },
  });
}

export function useDashboardStats(period: string = "all") {
  return useQuery({
    queryKey: ["admin", "dashboard-stats", period],
    queryFn: async () => {
      const adminToken =
        typeof window !== "undefined"
          ? localStorage.getItem("admin_token")
          : null;
      if (!adminToken) return null;
      const res = await fetch(`/api/admin/stats?period=${period}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.data || null;
    },
    staleTime: CACHE.ADMIN_DATA.staleTime,
    gcTime: CACHE.ADMIN_DATA.gcTime,
    refetchOnWindowFocus: false,
  });
}

export function useRemoveRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (address: string) => {
      const res = await fetch("/api/admin", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!res.ok) throw new Error("Lỗi khi xóa quyền");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admin.users() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admin.stats() });
    },
  });
}
