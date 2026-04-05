"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS, CACHE } from "@/lib/config/cache-config";

interface User {
  address: string;
  role: string;
  assigned_at: string;
  formattedAddress?: string;
  assignedAt?: string;
  // Company info
  company_name?: string;
  license_number?: string;
  license_ipfs_hash?: string;
  tax_id?: string;
  contact_email?: string;
  contact_phone?: string;
  company_address?: string;
  notes?: string;
}

export interface NFTBreakdown {
  minted: number;
  at_distributor: number;
  at_pharmacy: number;
  dispensed: number;
}

export interface AdminStats {
  totalNFTs?: number;
  nft?: NFTBreakdown;
  totalUsers: number;
  manufacturers: number;
  distributors: number;
  pharmacies: number;
  admins: number;
}

export interface AdminDashboardData {
  users: User[];
  stats: AdminStats;
  recentTransactions: any[];
}

function getAdminToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
}

/**
 * Normalize users from API response — handles multiple response formats.
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
 * PRIMARY HOOK — dùng cho admin page
 * Fetch users + stats + recent transactions trong 1 request duy nhất.
 * Users không cần token (public endpoint).
 * Stats cần admin_token để lấy NFT count.
 * Luôn trả về data hợp lệ (users count từ DB, NFT count từ /api/admin/stats nếu có token).
 */
export function useAdminDashboard() {
  return useQuery<AdminDashboardData, Error>({
    queryKey: ["admin", "dashboard-unified"],
    queryFn: async () => {
      const adminToken = getAdminToken();

      // Gọi users + stats song song
      const [usersRes, statsRes] = await Promise.all([
        fetch("/api/admin/users", { credentials: "include" }),
        adminToken
          ? fetch("/api/admin/stats?period=all", {
              headers: { Authorization: `Bearer ${adminToken}` },
              credentials: "include",
            })
          : Promise.resolve(null),
      ]);

      const users: User[] = usersRes.ok ? normalizeUsers(await usersRes.json()) : [];

      const stats: AdminStats = {
        totalUsers: users.length,
        manufacturers: users.filter((u) => u.role === "MANUFACTURER").length,
        distributors: users.filter((u) => u.role === "DISTRIBUTOR").length,
        pharmacies: users.filter((u) => u.role === "PHARMACY").length,
        admins: users.filter((u) => u.role === "ADMIN").length,
        totalNFTs: 0,
      };

      let recentTransactions: any[] = [];

      if (statsRes?.ok) {
        try {
          const statsData = await statsRes.json();
          if (statsData?.data) {
            stats.totalNFTs = parseInt(statsData.data.nft?.total_nfts || "0", 10);
            // Extract full NFT status breakdown from /api/admin/stats
            stats.nft = {
              minted: parseInt(statsData.data.nft?.minted || "0", 10),
              at_distributor: parseInt(statsData.data.nft?.at_distributor || "0", 10),
              at_pharmacy: parseInt(statsData.data.nft?.at_pharmacy || "0", 10),
              dispensed: parseInt(statsData.data.nft?.dispensed || "0", 10),
            };
            recentTransactions = statsData.data.recentTransactions || statsData.data.recent_transactions || [];
          }
        } catch {
          // stats parse failed, continue with 0 NFTs
        }
      }

      return { users, stats, recentTransactions };
    },
    staleTime: 30 * 1000,       // 30s stale time
    gcTime: 5 * 60 * 1000,    // keep in cache 5 min
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: 1000,
  });
}

// ===== DEPRECATED hooks — dùng useAdminDashboard thay vì các hooks bên dưới =====

/** @deprecated Dùng useAdminDashboard thay vì useUsers */
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
      if (!Array.isArray(users)) return [];
      return users;
    },
    staleTime: CACHE.ADMIN_DATA.staleTime,
    gcTime: CACHE.ADMIN_DATA.gcTime,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000,
  });
}

/** @deprecated Dùng useAdminDashboard thay vì useAdminStats */
export function useAdminStats() {
  return useQuery<AdminStats, Error>({
    queryKey: QUERY_KEYS.admin.stats(),
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      const data = await res.json();
      const users: User[] = normalizeUsers(data);

      return {
        totalNFTs: 0,
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

/** @deprecated Dùng useAdminDashboard thay vì useDashboardStats */
export function useDashboardStats(period: string = "all") {
  return useQuery({
    queryKey: ["admin", "dashboard-stats", period],
    queryFn: async () => {
      const adminToken = getAdminToken();
      if (!adminToken) return null;

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
          if (res.status === 401) return null;
          attempt++;
          if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1000 * attempt));
        } catch (err) {
          attempt++;
          if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
      return null;
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000,
  });
}

// ===== Mutations =====

export function useAssignRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ address, role }: { address: string; role: string }) => {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, role }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || "Lỗi khi cấp quyền");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard-unified"] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admin.users() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admin.stats() });
    },
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
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard-unified"] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admin.users() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admin.stats() });
    },
  });
}
