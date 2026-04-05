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

const REGISTER_URL = "/api/auth/admin/register"

export default function AdminRegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    registerKey: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
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
    setSuccess("")

    if (!formData.username || !formData.password || !formData.registerKey) {
      setError("Vui long nhap day du thong tin bat buoc")
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Mat khau xac nhan khong khop")
      return
    }

    if (formData.password.length < 8) {
      setError("Mat khau phai it nhat 8 ky tu")
      return
    }

    if (formData.username.length < 3) {
      setError("Tai khoan phai it nhat 3 ky tu")
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch(REGISTER_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          email: formData.email || undefined,
          registerKey: formData.registerKey,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess("Dang ky thanh cong! Vui long dang nhap.")
        setTimeout(() => router.push("/admin"), 2000)
      } else {
        setError(data.error?.message || data.error || "Dang ky that bai")
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
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">Dang ky Admin</CardTitle>
          <CardDescription>Tao tai khoan quan tri moi</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-200 bg-green-50">
                <AlertDescription className="text-green-800">{success}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="username">Tai khoan *</Label>
              <Input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Nhap tai khoan"
                disabled={isSubmitting}
                className="mt-1"
                autoComplete="username"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="email@example.com (khong bat buoc)"
                disabled={isSubmitting}
                className="mt-1"
                autoComplete="email"
              />
            </div>

            <div>
              <Label htmlFor="password">Mat khau *</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="It nhat 8 ky tu"
                  disabled={isSubmitting}
                  className="pr-10"
                  autoComplete="new-password"
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

            <div>
              <Label htmlFor="confirmPassword">Xac nhan mat khau *</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Nhap lai mat khau"
                disabled={isSubmitting}
                className="mt-1"
                autoComplete="new-password"
              />
            </div>

            <div>
              <Label htmlFor="registerKey">Ma dang ky *</Label>
              <Input
                id="registerKey"
                name="registerKey"
                type="password"
                value={formData.registerKey}
                onChange={handleInputChange}
                placeholder="Nhap ma dang ky"
                disabled={isSubmitting}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Ma nay duoc cau hinh boi admin truoc do qua bien moi truong ADMIN_REGISTER_KEY
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting || !!success}>
              {isSubmitting ? "Dang dang ky..." : "Dang ky"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              <Shield className="w-3 h-3" />
              Quay lai trang dang nhap
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
