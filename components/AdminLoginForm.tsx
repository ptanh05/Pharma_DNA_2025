"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, Eye, EyeOff, AlertCircle } from "lucide-react"
import { useAdminAuth } from "@/hooks/useAdminAuth"

export default function AdminLoginForm() {
  const { login, isLoading } = useAdminAuth()
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
    // Xóa lỗi khi người dùng bắt đầu nhập
    if (error) setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.username || !formData.password) {
      setError("Vui lòng nhập đầy đủ tài khoản và mật khẩu")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      const success = await login(formData.username, formData.password)

      if (!success) {
        setError("Tài khoản hoặc mật khẩu không đúng")
      }
    } catch (err) {
      setError("Có lỗi xảy ra. Vui lòng thử lại.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDemoLogin = () => {
    setFormData({
      username: "Admin123",
      password: "Admin123",
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">Đăng nhập Admin</CardTitle>
          <CardDescription>Truy cập bảng điều khiển quản trị hệ thống PharmaDNA</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Tài khoản</Label>
              <Input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Nhập tài khoản admin"
                disabled={isSubmitting}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password">Mật khẩu</Label>
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

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting || isLoading}>
              {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Thông tin đăng nhập demo:</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>
                <strong>Tài khoản:</strong> Admin123
              </p>
              <p>
                <strong>Mật khẩu:</strong> Admin123
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDemoLogin}
              className="mt-2 w-full bg-transparent border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              Điền thông tin demo
            </Button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">Chỉ dành cho quản trị viên hệ thống</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
