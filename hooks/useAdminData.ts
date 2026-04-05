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

interface AdminDashboardData {
  users: User[];
  stats: AdminStats;
  recentTransactions: any[];
}

function getAdminToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
}

/**
 * Normalize users from API response — handles multiple response formats.
 * API can return: { success: true, data: { users: [], total: 10 } }
 *                 or { data: { users: [] } }
 *                 or { users: [] }
 *                 or [{}]
 */
function normalizeUsers(data: any): User[] {
  if (!data) return [];
  if (data.success === false) return [];
  const users =
    data?.data?.users ??
    data?.users ??
    data?.data?.data?.users ??
    data?.data;
  if (Array.isArray(users)) return users;
  if (Array.isArray(data)) return data;
  return [];
}

/**
 * Unified hook — fetches users + stats + recent transactions in ONE parallel request.
 * Replaces useUsers + useAdminStats + useDashboardStats + useNFTs on the admin page.
 */
export function useAdminDashboard() {
  return useQuery<AdminDashboardData, Error>({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      const adminToken = getAdminToken();
      if (!adminToken) {
        throw new Error("Không có admin token");
      }

      const [usersRes, statsRes] = await Promise.all([
        fetch("/api/admin/users", { credentials: "include" }),
        fetch("/api/admin/stats?period=all", {
          headers: { Authorization: `Bearer ${adminToken}` },
          credentials: "include",
        }),
      ]);

      const users: User[] = usersRes.ok ? normalizeUsers(await usersRes.json()) : [];

      const stats: AdminStats = {
        totalNFTs: 0,
        totalUsers: users.length,
        manufacturers: users.filter((u) => u.role === "MANUFACTURER").length,
        distributors: users.filter((u) => u.role === "DISTRIBUTOR").length,
        pharmacies: users.filter((u) => u.role === "PHARMACY").length,
        admins: users.filter((u) => u.role === "ADMIN").length,
      };

      let recentTransactions: any[] = [];
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData?.data) {
          stats.totalNFTs = parseInt(statsData.data.nft?.total_nfts || "0");
          recentTransactions = statsData.data.recent_transactions || [];
        }
      }

      return { users, stats, recentTransactions };
    },
    staleTime: CACHE.ADMIN_DATA.staleTime,
    gcTime: CACHE.ADMIN_DATA.gcTime,
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: 1000,
  });
}

export function useUsers() {
  return useQuery<User[]>({
    queryKey: QUERY_KEYS.admin.users(),
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      const data = await res.json();

      if (!res.ok) {
        console.warn(`[/api/admin/users] HTTP ${res.status}:`, data?.error);
        return [];
      }

      const users = normalizeUsers(data);
      if (!Array.isArray(users)) {
        console.warn("[useUsers] API returned non-array, returning empty array");
        return [];
      }
      return users;
    },
    staleTime: CACHE.ADMIN_DATA.staleTime,
    gcTime: CACHE.ADMIN_DATA.gcTime,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000,
  });
}

export function useAdminStats() {
  return useQuery<AdminStats, Error>({
    queryKey: QUERY_KEYS.admin.stats(),
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      const data = await res.json();
      const users: User[] = normalizeUsers(data);

      let totalNFTs = 0;
      const adminToken =
        typeof window !== "undefined"
          ? localStorage.getItem("admin_token")
          : null;
      if (adminToken) {
        let attempt = 0;
        const maxAttempts = 3;
        while (attempt < maxAttempts) {
          try {
            const dashboardRes = await fetch("/api/admin/stats?period=all", {
              headers: { Authorization: `Bearer ${adminToken}` },
              credentials: "include",
            });
            if (dashboardRes.ok) {
              const dashboardData = await dashboardRes.json();
              totalNFTs = parseInt(dashboardData?.data?.nft?.total_nfts || "0");
              break;
            } else if (dashboardRes.status === 401) {
              console.error("[useAdminStats] Token hết hạn hoặc không hợp lệ (401)");
              break;
            } else {
              console.warn(`[useAdminStats] HTTP ${dashboardRes.status}, thử lại lần ${attempt + 1}/${maxAttempts}`);
              attempt++;
              if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1000 * attempt));
            }
          } catch (err) {
            attempt++;
            console.error(`[useAdminStats] Lỗi kết nối, thử lại lần ${attempt}/${maxAttempts}:`, err);
            if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1000 * attempt));
          }
        }
        if (attempt === maxAttempts) {
          console.error("[useAdminStats] Đã thử 3 lần nhưng không lấy được dữ liệu NFT");
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
    retry: 2,
    retryDelay: 1000,
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
        credentials: "include",
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
      if (!adminToken) {
        console.warn("[useDashboardStats] Không có admin_token, bỏ qua fetch dashboard stats");
        return null;
      }

      let attempt = 0;
      const maxAttempts = 3;
      while (attempt < maxAttempts) {
        try {
          const res = await fetch(`/api/admin/stats?period=${period}`, {
            headers: { Authorization: `Bearer ${adminToken}` },
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            return data.data || null;
          }
          if (res.status === 401) {
            console.error("[useDashboardStats] Token hết hạn hoặc không hợp lệ (401)");
            return null;
          }
          console.warn(`[useDashboardStats] HTTP ${res.status}, thử lại lần ${attempt + 1}/${maxAttempts}`);
          attempt++;
          if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1000 * attempt));
        } catch (err) {
          attempt++;
          console.error(`[useDashboardStats] Lỗi kết nối, thử lại lần ${attempt}/${maxAttempts}:`, err);
          if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
      console.error("[useDashboardStats] Đã thử 3 lần nhưng không lấy được dữ liệu dashboard");
      return null;
    },
    staleTime: CACHE.ADMIN_DATA.staleTime,
    gcTime: CACHE.ADMIN_DATA.gcTime,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000,
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
        credentials: "include",
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
