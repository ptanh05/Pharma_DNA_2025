"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWalletSui as useWallet } from "./useWalletSui";
import { useAdminAuth } from "./useAdminAuth";
import { QUERY_KEYS, CACHE } from "@/lib/config/cache-config";

export type UserRole = "ADMIN" | "MANUFACTURER" | "DISTRIBUTOR" | "PHARMACY" | null;

interface RoleData {
  hasRole: boolean;
  role: UserRole;
}

interface RolePermissions {
  canCreateDrug: boolean;
  canManageDistribution: boolean;
  canConfirmPharmacy: boolean;
  canManageUsers: boolean;
  canViewAdmin: boolean;
}

/**
 * Fetch user role from API — used by useQuery
 */
async function fetchUserRole(address: string): Promise<RoleData> {
  const res = await fetch(
    `/api/auth/user/me?address=${encodeURIComponent(address)}`
  );
  const data = await res.json();
  if (data.success && data.data?.hasRole) {
    return { hasRole: true, role: data.data.role as UserRole };
  }
  return { hasRole: false, role: null };
}

export function useRoleAuth() {
  const { account, isConnected } = useWallet();
  const { isAuthenticated: isAdminAuthenticated } = useAdminAuth();
  const queryClient = useQueryClient();

  // React Query-backed role fetching with automatic cache
  const {
    data: roleData,
    isLoading,
    refetch,
  } = useQuery<RoleData>({
    queryKey: QUERY_KEYS.auth.role(account ?? ""),
    queryFn: () => fetchUserRole(account!),
    enabled: !!account && isConnected,
    staleTime: CACHE.AUTH_DATA.staleTime,
    gcTime: CACHE.AUTH_DATA.gcTime,
    // Don't refetch on window focus — cache is short enough
    refetchOnWindowFocus: false,
  });

  const userRole = roleData?.role ?? null;

  // Force refresh (e.g., after role assignment)
  const checkUserRole = useCallback(
    (forceRefresh: boolean = false) => {
      if (forceRefresh && account) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.auth.role(account),
        });
      }
    },
    [queryClient, account]
  );

  // When wallet connects/disconnects, reset local state
  useEffect(() => {
    if (!isConnected || !account) {
      // Cache will handle this via query disable, but ensure sync
    }
  }, [account, isConnected]);

  const getRolePermissions = useCallback(
    (role: UserRole): RolePermissions => {
      if (isAdminAuthenticated) {
        return {
          canCreateDrug: true,
          canManageDistribution: true,
          canConfirmPharmacy: true,
          canManageUsers: true,
          canViewAdmin: true,
        };
      }

      switch (role) {
        case "ADMIN":
          return {
            canCreateDrug: true,
            canManageDistribution: true,
            canConfirmPharmacy: true,
            canManageUsers: true,
            canViewAdmin: true,
          };
        case "MANUFACTURER":
          return {
            canCreateDrug: true,
            canManageDistribution: false,
            canConfirmPharmacy: false,
            canManageUsers: false,
            canViewAdmin: false,
          };
        case "DISTRIBUTOR":
          return {
            canCreateDrug: false,
            canManageDistribution: true,
            canConfirmPharmacy: false,
            canManageUsers: false,
            canViewAdmin: false,
          };
        case "PHARMACY":
          return {
            canCreateDrug: false,
            canManageDistribution: false,
            canConfirmPharmacy: true,
            canManageUsers: false,
            canViewAdmin: false,
          };
        default:
          return {
            canCreateDrug: false,
            canManageDistribution: false,
            canConfirmPharmacy: false,
            canManageUsers: false,
            canViewAdmin: false,
          };
      }
    },
    [isAdminAuthenticated]
  );

  const permissions = getRolePermissions(userRole);

  const getRoleName = (role: UserRole): string => {
    switch (role) {
      case "ADMIN":
        return "Quản trị viên";
      case "MANUFACTURER":
        return "Nhà sản xuất";
      case "DISTRIBUTOR":
        return "Nhà phân phối";
      case "PHARMACY":
        return "Nhà thuốc";
      default:
        return "Chưa có quyền";
    }
  };

  const assignRole = useCallback(
    async (address: string, role: UserRole) => {
      if (!isAdminAuthenticated && !permissions.canManageUsers) {
        throw new Error("Bạn không có quyền cấp phép người dùng");
      }
      try {
        const res = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, role }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Lỗi khi cấp quyền");

        window.dispatchEvent(
          new CustomEvent("roleUpdated", { detail: { address, role } })
        );

        // Invalidate role cache for the affected address
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.auth.role(address),
        });

        // If assigning to current user, refresh their role
        if (address.toLowerCase() === account?.toLowerCase()) {
          setTimeout(() => checkUserRole(true), 500);
        }

        return true;
      } catch (error) {
        console.error("[useRoleAuth] assignRole error:", error);
        throw error;
      }
    },
    [isAdminAuthenticated, permissions, queryClient, account, checkUserRole]
  );

  const getAllUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      return data.success ? data.data?.users || [] : [];
    } catch {
      return [];
    }
  }, []);

  const removeRole = useCallback(
    async (address: string) => {
      if (!isAdminAuthenticated && !permissions.canManageUsers) {
        throw new Error("Bạn không có quyền xóa người dùng");
      }
      try {
        const res = await fetch("/api/admin", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        });
        if (!res.ok) throw new Error("Lỗi khi xóa quyền");

        window.dispatchEvent(new CustomEvent("roleUpdated"));

        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.auth.role(address),
        });

        if (address.toLowerCase() === account?.toLowerCase()) {
          setTimeout(() => checkUserRole(true), 500);
        }

        return true;
      } catch (error) {
        console.error("[useRoleAuth] removeRole error:", error);
        throw error;
      }
    },
    [isAdminAuthenticated, permissions, queryClient, account, checkUserRole]
  );

  return {
    userRole,
    roleName: getRoleName(userRole),
    permissions,
    isLoading,
    assignRole,
    removeRole,
    getAllUsers,
    checkUserRole,
  };
}
