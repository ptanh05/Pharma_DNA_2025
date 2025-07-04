"use client"

import type { ReactNode } from "react"
import { useRoleAuth, type UserRole } from "@/hooks/useRoleAuth"
import { useWallet } from "@/hooks/useWallet"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Shield, Lock, AlertTriangle } from "lucide-react"

interface RoleGuardProps {
  children: ReactNode
  requiredRoles: UserRole[]
  fallback?: ReactNode
}

export default function RoleGuard({ children, requiredRoles, fallback }: RoleGuardProps) {
  const { isConnected, connectWallet } = useWallet()
  const { userRole, roleName, isLoading } = useRoleAuth()

  // Đang tải thông tin role
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Đang kiểm tra quyền truy cập...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Chưa kết nối ví
  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader className="text-center">
            <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <CardTitle>Yêu cầu kết nối ví</CardTitle>
            <CardDescription>Vui lòng kết nối ví MetaMask để truy cập chức năng này</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={connectWallet} size="lg">
              Kết nối ví MetaMask
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Không có quyền truy cập
  if (!userRole || !requiredRoles.includes(userRole)) {
    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader className="text-center">
            <Lock className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <CardTitle className="text-red-600">Không có quyền truy cập</CardTitle>
            <CardDescription>
              {userRole
                ? `Vai trò hiện tại của bạn là "${roleName}". Chức năng này yêu cầu vai trò: ${requiredRoles
                    .map((role) => {
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
                          return role
                      }
                    })
                    .join(", ")}`
                : "Địa chỉ ví của bạn chưa được cấp quyền truy cập hệ thống"}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mx-auto mb-2" />
              <p className="text-sm text-yellow-800">Liên hệ quản trị viên để được cấp quyền truy cập</p>
            </div>
            <Button variant="outline" onClick={() => window.history.back()}>
              Quay lại
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Có quyền truy cập
  return <>{children}</>
}
