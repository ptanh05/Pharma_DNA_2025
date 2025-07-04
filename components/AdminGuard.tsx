"use client"

import type { ReactNode } from "react"
import { useAdminAuth } from "@/hooks/useAdminAuth"
import AdminLoginForm from "./AdminLoginForm"

interface AdminGuardProps {
  children: ReactNode
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const { isAuthenticated, isLoading } = useAdminAuth()

  // Đang kiểm tra trạng thái đăng nhập
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang kiểm tra quyền truy cập...</p>
        </div>
      </div>
    )
  }

  // Chưa đăng nhập - hiển thị form đăng nhập
  if (!isAuthenticated) {
    return <AdminLoginForm />
  }

  // Đã đăng nhập - hiển thị nội dung admin
  return <>{children}</>
}
