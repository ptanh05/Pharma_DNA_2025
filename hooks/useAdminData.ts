"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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

/**
 * Hook lấy danh sách users với caching
 */
export function useUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      const users = data?.data?.users ?? data?.users ?? data;
      return Array.isArray(users) ? users : [];
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
  });
}

/**
 * Hook lấy thống kê admin
 */
export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      // Lấy user stats
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      const users: User[] = data?.data?.users ?? data?.users ?? [];

      // Lấy NFT count từ dashboard stats
      let totalNFTs = 0;
      try {
        const dashboardRes = await fetch("/api/v1/admin/dashboard-stats?period=all");
        const dashboardData = await dashboardRes.json();
        totalNFTs = parseInt(dashboardData?.data?.nft?.total_nfts || "0");
      } catch (e) {
        console.error("Failed to fetch NFT stats:", e);
      }

      return {
        totalNFTs,
        totalUsers: users.length,
        manufacturers: users.filter((u) => u.role === "MANUFACTURER").length,
        distributors: users.filter((u) => u.role === "DISTRIBUTOR").length,
        pharmacies: users.filter((u) => u.role === "PHARMACY").length,
        admins: users.filter((u) => u.role === "ADMIN").length,
      } as AdminStats;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Hook cấp quyền user
 */
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
      // Invalidate cache để refetch dữ liệu mới
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}

/**
 * Hook xóa quyền user
 */
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
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}
