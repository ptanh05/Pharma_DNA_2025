"use client"

import { useState, useEffect } from "react"
import { useWallet } from "./useWallet"
import { useAdminAuth } from "./useAdminAuth"

export type UserRole = "ADMIN" | "MANUFACTURER" | "DISTRIBUTOR" | "PHARMACY" | null

interface RolePermissions {
  canCreateDrug: boolean
  canManageDistribution: boolean
  canConfirmPharmacy: boolean
  canManageUsers: boolean
  canViewAdmin: boolean
}

// Mock database - trong thực tế sẽ lưu trong smart contract hoặc database
const ROLE_DATABASE: Record<string, UserRole> = {
  // Admin addresses
  "0x742d35Cc6634C0532925a3b8D4C9db96590c6C87": "ADMIN",
  "0x8ba1f109551bD432803012645Hac136c9.SetWalletAddress": "ADMIN",

  // Manufacturer addresses
  "0x1234567890123456789012345678901234567890": "MANUFACTURER",
  "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd": "MANUFACTURER",

  // Distributor addresses
  "0x9876543210987654321098765432109876543210": "DISTRIBUTOR",
  "0xfedcbafedcbafedcbafedcbafedcbafedcbafed": "DISTRIBUTOR",

  // Pharmacy addresses
  "0x1111111111111111111111111111111111111111": "PHARMACY",
  "0x2222222222222222222222222222222222222222": "PHARMACY",
}

export function useRoleAuth() {
  const { account, isConnected } = useWallet()
  const { isAuthenticated: isAdminAuthenticated } = useAdminAuth()
  const [userRole, setUserRole] = useState<UserRole>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkUserRole()
  }, [account, isConnected])

  const checkUserRole = async () => {
    setIsLoading(true)

    if (!isConnected || !account) {
      setUserRole(null)
      setIsLoading(false)
      return
    }

    try {
      // TODO: Trong thực tế, gọi smart contract để lấy role
      // const role = await contract.getUserRole(account)

      // Mock: Kiểm tra trong database giả lập
      const role = ROLE_DATABASE[account] || null
      setUserRole(role)
    } catch (error) {
      console.error("Error checking user role:", error)
      setUserRole(null)
    } finally {
      setIsLoading(false)
    }
  }

  const getRolePermissions = (role: UserRole): RolePermissions => {
    // Nếu đã đăng nhập admin qua form login, có full quyền
    if (isAdminAuthenticated) {
      return {
        canCreateDrug: true,
        canManageDistribution: true,
        canConfirmPharmacy: true,
        canManageUsers: true,
        canViewAdmin: true,
      }
    }

    switch (role) {
      case "ADMIN":
        return {
          canCreateDrug: true,
          canManageDistribution: true,
          canConfirmPharmacy: true,
          canManageUsers: true,
          canViewAdmin: true,
        }
      case "MANUFACTURER":
        return {
          canCreateDrug: true,
          canManageDistribution: false,
          canConfirmPharmacy: false,
          canManageUsers: false,
          canViewAdmin: false,
        }
      case "DISTRIBUTOR":
        return {
          canCreateDrug: false,
          canManageDistribution: true,
          canConfirmPharmacy: false,
          canManageUsers: false,
          canViewAdmin: false,
        }
      case "PHARMACY":
        return {
          canCreateDrug: false,
          canManageDistribution: false,
          canConfirmPharmacy: true,
          canManageUsers: false,
          canViewAdmin: false,
        }
      default:
        return {
          canCreateDrug: false,
          canManageDistribution: false,
          canConfirmPharmacy: false,
          canManageUsers: false,
          canViewAdmin: false,
        }
    }
  }

  const permissions = getRolePermissions(userRole)

  const getRoleName = (role: UserRole): string => {
    switch (role) {
      case "ADMIN":
        return "Quản trị viên"
      case "MANUFACTURER":
        return "Nhà sản xuất"
      case "DISTRIBUTOR":
        return "Nhà phân phối"
      case "PHARMACY":
        return "Nhà thuốc"
      default:
        return "Chưa có quyền"
    }
  }

  // Hàm để admin cấp quyền (mock)
  const assignRole = async (address: string, role: UserRole) => {
    // Kiểm tra quyền: admin đăng nhập hoặc có role ADMIN từ ví
    if (!isAdminAuthenticated && !permissions.canManageUsers) {
      throw new Error("Bạn không có quyền cấp phép người dùng")
    }

    try {
      // TODO: Trong thực tế, gọi smart contract
      // await contract.assignRole(address, role)

      // Mock: Cập nhật database giả lập
      if (role) {
        ROLE_DATABASE[address] = role
      } else {
        delete ROLE_DATABASE[address]
      }

      // Trigger re-render cho các component khác
      window.dispatchEvent(new CustomEvent("roleUpdated"))

      return true
    } catch (error) {
      console.error("Error assigning role:", error)
      throw error
    }
  }

  // Thêm hàm để lấy danh sách tất cả người dùng
  const getAllUsers = () => {
    return Object.entries(ROLE_DATABASE).map(([address, role]) => ({
      address,
      role,
      assignedAt: new Date().toLocaleDateString("vi-VN"), // Mock date
    }))
  }

  // Thêm hàm xóa quyền
  const removeRole = async (address: string) => {
    // Kiểm tra quyền: admin đăng nhập hoặc có role ADMIN từ ví
    if (!isAdminAuthenticated && !permissions.canManageUsers) {
      throw new Error("Bạn không có quyền xóa người dùng")
    }

    try {
      // TODO: Trong thực tế, gọi smart contract
      // await contract.removeRole(address)

      // Mock: Xóa khỏi database giả lập
      delete ROLE_DATABASE[address]

      // Trigger re-render cho các component khác
      window.dispatchEvent(new CustomEvent("roleUpdated"))

      return true
    } catch (error) {
      console.error("Error removing role:", error)
      throw error
    }
  }

  // Cập nhật return statement để bao gồm các hàm mới
  return {
    userRole,
    roleName: getRoleName(userRole),
    permissions,
    isLoading,
    assignRole,
    removeRole,
    getAllUsers,
    checkUserRole,
  }
}
