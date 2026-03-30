"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

interface AdminAuthState {
  isAuthenticated: boolean
  isLoading: boolean
}

const ADMIN_CREDENTIALS = {
  username: process.env.NEXT_PUBLIC_ADMIN_USERNAME || "admin",
  password: "", // password is sent to API, not stored here
}

const ADMIN_LOGIN_URL = "/api/auth/admin/login"

export function useAdminAuth() {
  const [authState, setAuthState] = useState<AdminAuthState>({
    isAuthenticated: false,
    isLoading: true,
  })

  const router = useRouter();
  
  useEffect(() => {
    // Skip on server-side
    if (typeof window === 'undefined') {
      return;
    }
    checkAuthStatus()
  }, [])

  const checkAuthStatus = () => {
    setAuthState((prev) => ({ ...prev, isLoading: true }))

    // Kiểm tra localStorage để xem đã đăng nhập chưa
    const adminToken = localStorage.getItem("admin_token")
    const loginTime = localStorage.getItem("admin_login_time")

    if (adminToken && loginTime) {
      const now = Date.now()
      const loginTimestamp = Number.parseInt(loginTime)
      const sessionDuration = 24 * 60 * 60 * 1000 // 24 giờ

      if (now - loginTimestamp < sessionDuration) {
        setAuthState({ isAuthenticated: true, isLoading: false })
        return
      } else {
        // Session hết hạn
        localStorage.removeItem("admin_token")
        localStorage.removeItem("admin_login_time")
      }
    }

    setAuthState({ isAuthenticated: false, isLoading: false })
  }

  const login = async (username: string, password: string): Promise<boolean> => {
    setAuthState((prev) => ({ ...prev, isLoading: true }))

    try {
      const res = await fetch(ADMIN_LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()

      if (res.ok && data.success && data.data?.token) {
        localStorage.setItem("admin_token", data.data.token)
        localStorage.setItem("admin_login_time", Date.now().toString())
        setAuthState({ isAuthenticated: true, isLoading: false })
        window.location.reload();
        return true
      } else {
        setAuthState({ isAuthenticated: false, isLoading: false })
        return false
      }
    } catch (error) {
      console.error("[useAdminAuth] Login error:", error)
      setAuthState({ isAuthenticated: false, isLoading: false })
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem("admin_token")
    localStorage.removeItem("admin_login_time")
    setAuthState({ isAuthenticated: false, isLoading: false })
    router.refresh();
    window.location.reload()
  }

  return {
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    login,
    logout,
    checkAuthStatus,
  }
}
