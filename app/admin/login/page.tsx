"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, Eye, EyeOff, AlertCircle, LogIn } from "lucide-react"
import { useAdminAuth } from "@/hooks/useAdminAuth"

const LOGIN_URL = "/api/auth/admin/login"

export default function AdminLoginPage() {
  const router = useRouter()
  const { login } = useAdminAuth()
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
    if (error) setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!formData.username || !formData.password) {
      setError("Vui lòng nhập đầy đủ thông tin")
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch(LOGIN_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
        }),
      })

      if (res.ok) {
        // Login successful — use the hook to update state, then redirect
        await login(formData.username, formData.password)
        router.push("/admin")
      } else {
        const data = await res.json()
        setError(data.error?.message || data.error || "Đăng nhập thất bại")
      }
    } catch (err) {
      setError("Có lỗi xảy ra. Vui lòng thử lại.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">Đăng nhập Admin</CardTitle>
          <CardDescription>PharmaDNA - Quản trị hệ thống</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="username">Tài khoản *</Label>
              <Input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Nhập tài khoản"
                disabled={isSubmitting}
                className="mt-1"
                autoComplete="username"
              />
            </div>

            <div>
              <Label htmlFor="password">Mật khẩu *</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Nhập mật khẩu"
                  disabled={isSubmitting}
                  className="pr-10"
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSubmitting}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="animate-spin mr-2">⟳</span>
                  Đang đăng nhập...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Đăng nhập
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => router.push("/admin/register")}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              Chưa có tài khoản? Đăng ký
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
