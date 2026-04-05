"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"

const ADMIN_ME_URL = "/api/auth/admin/me"
const ADMIN_LOGIN_URL = "/api/auth/admin/login"
const ADMIN_LOGOUT_URL = "/api/auth/admin/logout"

export interface AdminUser {
  id: number
  username: string
  email: string | null
  role: string
  created_at: string
  last_login: string | null
}

export interface AdminAuthState {
  isAuthenticated: boolean
  isLoading: boolean
  user: AdminUser | null
}

export function useAdminAuth() {
  const [authState, setAuthState] = useState<AdminAuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
  })

  const router = useRouter()

  const checkAuthStatus = useCallback(async () => {
    // Skip on server-side
    if (typeof window === "undefined") return

    setAuthState((prev) => ({ ...prev, isLoading: true }))

    try {
      const res = await fetch(ADMIN_ME_URL, {
        credentials: "include", // Send cookies
      })

      if (res.ok) {
        const data = await res.json()
        setAuthState({
          isAuthenticated: true,
          isLoading: false,
          user: data.data ?? null,
        })
      } else {
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
        })
      }
    } catch (error) {
      console.error("[useAdminAuth] Auth check error:", error)
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      })
    }
  }, [])

  useEffect(() => {
    checkAuthStatus()
  }, [checkAuthStatus])

  const login = async (username: string, password: string): Promise<boolean> => {
    setAuthState((prev) => ({ ...prev, isLoading: true }))

    try {
      const res = await fetch(ADMIN_LOGIN_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      if (res.ok) {
        const data = await res.json()
        setAuthState({
          isAuthenticated: true,
          isLoading: false,
          user: data.data?.user ?? null,
        })
        router.refresh()
        return true
      } else {
        setAuthState((prev) => ({ ...prev, isLoading: false }))
        return false
      }
    } catch (error) {
      console.error("[useAdminAuth] Login error:", error)
      setAuthState((prev) => ({ ...prev, isLoading: false }))
      return false
    }
  }

  const logout = async () => {
    try {
      await fetch(ADMIN_LOGOUT_URL, {
        method: "GET",
        credentials: "include",
      })
    } catch (error) {
      console.error("[useAdminAuth] Logout error:", error)
    }

    setAuthState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    })
    router.refresh()
  }

  return {
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    user: authState.user,
    login,
    logout,
    checkAuthStatus,
  }
}
