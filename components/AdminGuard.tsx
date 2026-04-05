"use client"

import type { ReactNode } from "react"
import { useAdminAuth } from "@/hooks/useAdminAuth"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Shield, Lock } from "lucide-react"

interface AdminGuardProps {
  children: ReactNode
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const { isAuthenticated, isLoading } = useAdminAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Redirect to the admin login page
      router.push("/admin")
    }
  }, [isLoading, isAuthenticated, router])

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Dang kiem tra quyen truy cap...</p>
        </div>
      </div>
    )
  }

  // Authenticated — render children
  if (isAuthenticated) {
    return <>{children}</>
  }

  // Not authenticated — show clean "Access Denied" page while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="mx-auto mb-6 w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
          <Lock className="w-10 h-10 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-600 mb-6">
          You do not have permission to access the admin dashboard.
          Please log in with a valid admin account.
        </p>
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Shield className="w-4 h-4" />
          Go to Login
        </button>
      </div>
    </div>
  )
}
