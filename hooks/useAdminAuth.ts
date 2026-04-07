"use client"

import { useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"

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

async function fetchAdminMe(): Promise<AdminUser | null> {
  const res = await fetch(ADMIN_ME_URL, { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data ?? null;
}

export function useAdminAuth() {
  // React Query-backed auth — cached, deduplicated, instant on repeat renders
  const { data: adminUser, isLoading, refetch } = useQuery<AdminUser | null>({
    queryKey: ["admin", "auth", "me"],
    queryFn: fetchAdminMe,
    staleTime: 2 * 60 * 1000,     // 2 min — fast enough for session check
    gcTime: 30 * 60 * 1000,       // 30 min
    refetchOnWindowFocus: true,
    retry: 1,
    initialData: null,              // No SSR hydration mismatch
  });

  const router = useRouter()

  const checkAuthStatus = useCallback(async () => {
    await refetch();
  }, [refetch]);

  useEffect(() => {
    checkAuthStatus()
  }, [checkAuthStatus])

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch(ADMIN_LOGIN_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      if (res.ok) {
        await refetch(); // React Query will update adminUser
        router.refresh()
        return true
      }
      return false
    } catch (error) {
      console.error("[useAdminAuth] Login error:", error)
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
    // Invalidate cache so next render gets fresh state
    await refetch();
    router.refresh()
  }

  return {
    isAuthenticated: adminUser !== null,
    isLoading,
    user: adminUser,
    login,
    logout,
    checkAuthStatus,
  }
}
