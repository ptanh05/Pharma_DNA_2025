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
      // Gọi API backend để lấy role thực tế
      const res = await fetch('/api/admin')
      const users = await res.json()
      const user = users.find((u: any) => u.address.toLowerCase() === account.toLowerCase())
      setUserRole(user ? user.role : null)
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

  // Hàm để admin cấp quyền (gọi API backend)
  const assignRole = async (address: string, role: UserRole) => {
    if (!isAdminAuthenticated && !permissions.canManageUsers) {
      throw new Error("Bạn không có quyền cấp phép người dùng")
    }
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, role })
      })
      if (!res.ok) throw new Error('Lỗi khi cấp quyền')
      window.dispatchEvent(new CustomEvent("roleUpdated"))
      return true
    } catch (error) {
      console.error("Error assigning role:", error)
      throw error
    }
  }

  // Lấy danh sách tất cả người dùng từ backend
  const getAllUsers = () => {
    // Hàm này nên trả về promise để đồng bộ với API
    // Nhưng để giữ tương thích với code cũ, trả về [] và nên refactor nơi gọi để dùng async
    return []
  }

  // Hàm xóa quyền (gọi API backend)
  const removeRole = async (address: string) => {
    if (!isAdminAuthenticated && !permissions.canManageUsers) {
      throw new Error("Bạn không có quyền xóa người dùng")
    }
    try {
      const res = await fetch('/api/admin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      })
      if (!res.ok) throw new Error('Lỗi khi xóa quyền')
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
