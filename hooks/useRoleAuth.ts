"use client";

import { useState, useEffect, useCallback } from "react";
import { useWalletSui as useWallet } from "./useWalletSui";
import { useAdminAuth } from "./useAdminAuth";

export type UserRole = "ADMIN" | "MANUFACTURER" | "DISTRIBUTOR" | "PHARMACY" | null;

interface RolePermissions {
  canCreateDrug: boolean;
  canManageDistribution: boolean;
  canConfirmPharmacy: boolean;
  canManageUsers: boolean;
  canViewAdmin: boolean;
}

export function useRoleAuth() {
  const { account, isConnected } = useWallet();
  const { isAuthenticated: isAdminAuthenticated } = useAdminAuth();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hàm checkUserRole được export ra ngoài để có thể gọi từ component khác
  // Sử dụng useRef để lưu account mà không phụ thuộc vào reference change
  const checkUserRole = useCallback(async (forceRefresh: boolean = false) => {
    // Skip on server-side - only run on client
    if (typeof window === 'undefined') {
      return;
    }

    // Nếu chưa kết nối ví hoặc không có account thì reset role
    if (!isConnected || !account) {
      setUserRole(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // Thêm timestamp để tránh cache
      const timestamp = forceRefresh ? `&_t=${Date.now()}` : '';
      const url = `/api/auth/user/me?address=${encodeURIComponent(account)}${timestamp}`;
      
      // Gọi API để lấy role của user hiện tại
      const res = await fetch(url);
      const data = await res.json();

      console.log("[useRoleAuth] API response:", data);

      if (data.success && data.data?.hasRole) {
        const role = data.data.role as UserRole;
        console.log("[useRoleAuth] Setting role:", role);
        setUserRole(role);
      } else {
        console.log("[useRoleAuth] No role found for user");
        setUserRole(null);
      }
    } catch (error) {
      console.error("[useRoleAuth] Error checking user role:", error);
      setUserRole(null);
    } finally {
      setIsLoading(false);
    }
  }, [account, isConnected]);

  // Check role khi account hoặc isConnected thay đổi
  useEffect(() => {
    checkUserRole();
  }, [account, isConnected, checkUserRole]);

  const getRolePermissions = (role: UserRole): RolePermissions => {
    // Nếu đã đăng nhập admin qua form login, có full quyền
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
  };

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

  // Hàm để admin cấp quyền (gọi API backend)
  const assignRole = async (address: string, role: UserRole) => {
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
      console.log("[useRoleAuth] assignRole response:", data);
      
      if (!res.ok) throw new Error(data.error || 'Lỗi khi cấp quyền');
      
      // Trigger role update event để các component khác refresh
      window.dispatchEvent(new CustomEvent("roleUpdated", { detail: { address, role } }));
      
      // Nếu address được cấp quyền chính là account hiện tại, thì refresh role ngay
      if (address.toLowerCase() === account?.toLowerCase()) {
        console.log("[useRoleAuth] Refreshing role for current user");
        // Đợi một chút để đảm bảo DB đã được cập nhật
        setTimeout(() => {
          checkUserRole(true);
        }, 500);
      }
      
      return true;
    } catch (error) {
      console.error("[useRoleAuth] Error assigning role:", error);
      throw error;
    }
  };

  // Lấy danh sách tất cả người dùng từ backend (async version)
  const getAllUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      return data.success ? data.data?.users || [] : [];
    } catch (error) {
      console.error("[useRoleAuth] Error getting all users:", error);
      return [];
    }
  };

  // Hàm xóa quyền (gọi API backend)
  const removeRole = async (address: string) => {
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
      
      // Trigger role update event
      window.dispatchEvent(new CustomEvent("roleUpdated"));
      
      // Nếu address bị xóa quyền chính là account hiện tại, thì refresh role
      if (address.toLowerCase() === account?.toLowerCase()) {
        setTimeout(() => {
          checkUserRole(true);
        }, 500);
      }
      
      return true;
    } catch (error) {
      console.error("[useRoleAuth] Error removing role:", error);
      throw error;
    }
  };

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
