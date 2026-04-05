"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, Eye, EyeOff, AlertCircle, UserPlus } from "lucide-react"
import { useAdminAuth } from "@/hooks/useAdminAuth"

export default function AdminLoginForm() {
  const { login, isLoading } = useAdminAuth()
  const router = useRouter()
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

    if (!formData.username || !formData.password) {
      setError("Vui long nhap day du tai khoan va mat khau")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      const success = await login(formData.username, formData.password)

      if (success) {
        // Cookies are set by the API — just redirect to admin dashboard
        router.push("/admin")
      } else {
        setError("Tai khoan hoac mat khau khong dung")
      }
    } catch (err) {
      setError("Co loi xay ra. Vui long thu lai.")
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
          <CardTitle className="text-2xl font-bold text-gray-900">Dang nhap Admin</CardTitle>
          <CardDescription>Truy cap bang dieu khien quan tri he thong PharmaDNA</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Tai khoan</Label>
              <Input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Nhap tai khoan admin"
                disabled={isSubmitting}
                className="mt-1"
                autoComplete="username"
              />
            </div>

            <div>
              <Label htmlFor="password">Mat khau</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Nhap mat khau"
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

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting || isLoading}>
              {isSubmitting ? "Dang nhap..." : "Dang nhap"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">Chi danh cho quan tri vien he thong</p>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => router.push("/admin/register")}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                <UserPlus className="w-3 h-3" />
                Dang ky tai khoan moi
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
