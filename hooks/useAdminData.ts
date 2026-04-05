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
  totalUsers: number;
  currentPage: number;
  perPage: number;
}

/**
 * Normalize users from API response — handles multiple response formats.
 */
function normalizeUsers(data: any): { users: User[]; total: number } {
  if (!data) return { users: [], total: 0 };
  if (data.success === false) return { users: [], total: 0 };

  const usersRaw =
    data?.data?.users ??
    data?.users ??
    data?.data?.data?.users ??
    data?.data;

  const total =
    data?.total ??
    data?.data?.total ??
    data?.data?.data?.total ??
    (Array.isArray(usersRaw) ? usersRaw.length : 0);

  const users = Array.isArray(usersRaw) ? usersRaw : [];
  return { users, total };
}

/**
 * PRIMARY HOOK — dùng cho admin page
 * Fetch users (paginated) + stats + recent transactions.
 * Users paginated: page & perPage params. Stats/recentTxs chỉ fetch ở page 1.
 * Luôn trả về data hợp lệ (users count từ DB, NFT count từ /api/admin/stats nếu có token).
 */
export function useAdminDashboard(page: number = 1, perPage: number = 4) {
  return useQuery<AdminDashboardData, Error>({
    queryKey: ["admin", "dashboard-unified", page, perPage],
    queryFn: async () => {
      const [usersRes, statsRes] = await Promise.all([
        fetch(`/api/admin/users?page=${page}&limit=${perPage}`, { credentials: "include" }),
        page === 1
          ? fetch("/api/admin/stats?period=all", { credentials: "include" })
          : Promise.resolve(null),
      ]);

      const { users: paginatedUsers, total } = usersRes.ok
        ? normalizeUsers(await usersRes.json())
        : { users: [], total: 0 };

      const stats: AdminStats = {
        totalUsers: total,
        manufacturers: 0,
        distributors: 0,
        pharmacies: 0,
        admins: 0,
        totalNFTs: 0,
      };

      let recentTransactions: any[] = [];

      if (page === 1 && statsRes) {
        try {
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            if (statsData?.data) {
              stats.totalNFTs = parseInt(statsData.data.nft?.total_nfts || "0", 10);
              stats.nft = {
                minted: parseInt(statsData.data.nft?.minted || "0", 10),
                at_distributor: parseInt(statsData.data.nft?.at_distributor || "0", 10),
                at_pharmacy: parseInt(statsData.data.nft?.at_pharmacy || "0", 10),
                dispensed: parseInt(statsData.data.nft?.dispensed || "0", 10),
              };
              recentTransactions = statsData.data.recentTransactions || statsData.data.recent_transactions || [];
            }
          }
        } catch {
          // stats parse failed, continue with 0 NFTs
        }
      }

      return { users: paginatedUsers, stats, recentTransactions, totalUsers: total, currentPage: page, perPage };
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
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
      let attempt = 0;
      const maxAttempts = 3;
      while (attempt < maxAttempts) {
        try {
          const res = await fetch(`/api/admin/stats?period=${period}`, {
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

/**
 * Fetches user role counts (total, manufacturers, distributors, pharmacies, admins).
 * Used for stats summary — separate from paginated user list.
 */
export function useUserStats() {
  return useQuery<{
    totalUsers: number;
    manufacturers: number;
    distributors: number;
    pharmacies: number;
    admins: number;
  }>({
    queryKey: ["admin", "user-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users?page=1&limit=1000", { credentials: "include" });
      if (!res.ok) {
        return { totalUsers: 0, manufacturers: 0, distributors: 0, pharmacies: 0, admins: 0 };
      }
      const data = await res.json();
      const users = normalizeUsers(data).users;
      return {
        totalUsers: users.length,
        manufacturers: users.filter((u) => u.role === "MANUFACTURER").length,
        distributors: users.filter((u) => u.role === "DISTRIBUTOR").length,
        pharmacies: users.filter((u) => u.role === "PHARMACY").length,
        admins: users.filter((u) => u.role === "ADMIN").length,
      };
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
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
      queryClient.invalidateQueries({ queryKey: ["admin", "user-stats"] });
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
      queryClient.invalidateQueries({ queryKey: ["admin", "user-stats"] });
    },
  });
}

export interface UpdateUserInfoData {
  address: string;
  company_name?: string;
  license_number?: string;
  license_ipfs_hash?: string;
  tax_id?: string;
  contact_email?: string;
  contact_phone?: string;
  company_address?: string;
  notes?: string;
}

export function useUpdateUserInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateUserInfoData) => {
      const res = await fetch(`/api/admin/users/${data.address}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Lỗi khi cập nhật thông tin");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard-unified"] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admin.users() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admin.stats() });
      queryClient.invalidateQueries({ queryKey: ["admin", "user-stats"] });
    },
  });
}
