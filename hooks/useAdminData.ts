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
      // Extract users from various possible response structures
      const users = data?.data?.users ?? data?.data ?? data?.users ?? data;
      // Always return an array, even if cache is corrupted
      if (!Array.isArray(users)) {
        console.warn("[useUsers] API returned non-array, returning empty array");
        return [];
      }
      return users;
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
      const users: User[] = data?.data?.users ?? data?.data ?? data?.users ?? [];

      // Lấy NFT count từ dashboard stats (chỉ gọi khi có token)
      let totalNFTs = 0;
      const adminToken = typeof window !== 'undefined' ? localStorage.getItem("admin_token") : null;
      if (adminToken) {
        try {
          const dashboardRes = await fetch("/api/admin/stats?period=all", {
            headers: { Authorization: `Bearer ${adminToken}` },
          });
          if (dashboardRes.ok) {
            const dashboardData = await dashboardRes.json();
            totalNFTs = parseInt(dashboardData?.data?.nft?.total_nfts || "0");
          }
        } catch (e) {
          // Silently ignore — user có thể chưa login
        }
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
