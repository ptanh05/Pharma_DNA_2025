"use client"

import { useState, useEffect } from "react"

interface AdminAuthState {
  isAuthenticated: boolean
  isLoading: boolean
}

const ADMIN_CREDENTIALS = {
  username: "Admin123",
  password: "Admin123",
}

export function useAdminAuth() {
  const [authState, setAuthState] = useState<AdminAuthState>({
    isAuthenticated: false,
    isLoading: true,
  })

  useEffect(() => {
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

    // Giả lập delay API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
      // Tạo token đơn giản (trong thực tế nên dùng JWT)
      const token = btoa(`${username}:${Date.now()}`)
      localStorage.setItem("admin_token", token)
      localStorage.setItem("admin_login_time", Date.now().toString())

      setAuthState({ isAuthenticated: true, isLoading: false })
      return true
    } else {
      setAuthState({ isAuthenticated: false, isLoading: false })
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem("admin_token")
    localStorage.removeItem("admin_login_time")
    setAuthState({ isAuthenticated: false, isLoading: false })
  }

  return {
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    login,
    logout,
    checkAuthStatus,
  }
}
