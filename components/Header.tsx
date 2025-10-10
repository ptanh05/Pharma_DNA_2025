"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu, X, Wallet, LogOut, AlertTriangle, Shield } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useRoleAuth } from "@/hooks/useRoleAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdminAuth } from "@/hooks/useAdminAuth";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const {
    account,
    isConnected,
    isConnecting,
    networkName,
    isCorrectNetwork,
    connectWallet,
    disconnectWallet,
    switchToPharmaDNA,
  } = useWallet();

  const { userRole, roleName, permissions, checkUserRole } = useRoleAuth();
  const { isAuthenticated: isAdminAuthenticated, logout: adminLogout } =
    useAdminAuth();

  // Thêm useEffect để lắng nghe cập nhật role
  useEffect(() => {
    const handleRoleUpdate = () => {
      // Trigger re-check role khi có cập nhật
      checkUserRole();
    };

    window.addEventListener("roleUpdated", handleRoleUpdate);
    return () => window.removeEventListener("roleUpdated", handleRoleUpdate);
  }, [checkUserRole]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-red-100 text-red-800";
      case "MANUFACTURER":
        return "bg-blue-100 text-blue-800";
      case "DISTRIBUTOR":
        return "bg-green-100 text-green-800";
      case "PHARMACY":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="text-2xl font-bold text-blue-600">
              PharmaDNA
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            <Link
              href="/"
              className="text-gray-700 hover:text-blue-600 transition-colors"
            >
              Trang chủ
            </Link>

            {permissions.canCreateDrug && (
              <Link
                href="/manufacturer"
                className="text-gray-700 hover:text-blue-600 transition-colors"
              >
                Nhà sản xuất
              </Link>
            )}

            {permissions.canManageDistribution && (
              <Link
                href="/distributor"
                className="text-gray-700 hover:text-blue-600 transition-colors"
              >
                Nhà phân phối
              </Link>
            )}

            {permissions.canConfirmPharmacy && (
              <Link
                href="/pharmacy"
                className="text-gray-700 hover:text-blue-600 transition-colors"
              >
                Nhà thuốc
              </Link>
            )}

            <Link
              href="/lookup"
              className="text-gray-700 hover:text-blue-600 transition-colors"
            >
              Tra cứu
            </Link>

            <Link
              href="/admin"
              className="text-gray-700 hover:text-blue-600 transition-colors"
            >
              Admin
            </Link>
          </nav>

          {/* Wallet Connect Button */}
          <div className="hidden md:flex items-center space-x-3">
            {isConnected && userRole && (
              <Badge className={getRoleBadgeColor(userRole)}>
                <Shield className="w-3 h-3 mr-1" />
                {roleName}
              </Badge>
            )}

            {!isConnected ? (
              <Button onClick={connectWallet} disabled={isConnecting}>
                <Wallet className="w-4 h-4 mr-2" />
                {isConnecting ? "Đang kết nối..." : "Kết nối ví"}
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex items-center space-x-2 bg-transparent"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="font-mono">
                        {formatAddress(account!)}
                      </span>
                      {!isCorrectNetwork && (
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium">Địa chỉ ví</p>
                    <p className="text-xs text-gray-500 font-mono">{account}</p>
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium">Vai trò</p>
                    <Badge
                      className={`text-xs ${getRoleBadgeColor(userRole || "")}`}
                    >
                      {roleName}
                    </Badge>
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium">Mạng</p>
                    <p className="text-xs text-gray-500">{networkName}</p>
                  </div>
                  {!isCorrectNetwork && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={switchToPharmaDNA}>
                        Chuyển sang PharmaDNA Chainlet
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={disconnectWallet}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Ngắt kết nối
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t">
              <Link
                href="/"
                className="block px-3 py-2 text-gray-700 hover:text-blue-600"
              >
                Trang chủ
              </Link>

              {permissions.canCreateDrug && (
                <Link
                  href="/manufacturer"
                  className="block px-3 py-2 text-gray-700 hover:text-blue-600"
                >
                  Nhà sản xuất
                </Link>
              )}

              {permissions.canManageDistribution && (
                <Link
                  href="/distributor"
                  className="block px-3 py-2 text-gray-700 hover:text-blue-600"
                >
                  Nhà phân phối
                </Link>
              )}

              {permissions.canConfirmPharmacy && (
                <Link
                  href="/pharmacy"
                  className="block px-3 py-2 text-gray-700 hover:text-blue-600"
                >
                  Nhà thuốc
                </Link>
              )}

              <Link
                href="/lookup"
                className="block px-3 py-2 text-gray-700 hover:text-blue-600"
              >
                Tra cứu
              </Link>

              <Link
                href="/admin"
                className="block px-3 py-2 text-gray-700 hover:text-blue-600"
              >
                Admin
              </Link>

              <div className="px-3 py-2">
                {isConnected && userRole && (
                  <Badge className={`mb-2 ${getRoleBadgeColor(userRole)}`}>
                    <Shield className="w-3 h-3 mr-1" />
                    {roleName}
                  </Badge>
                )}

                {!isConnected ? (
                  <Button
                    onClick={connectWallet}
                    disabled={isConnecting}
                    className="w-full"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    {isConnecting ? "Đang kết nối..." : "Kết nối ví"}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="text-xs font-medium">Đã kết nối:</p>
                      <p className="text-xs font-mono">
                        {formatAddress(account!)}
                      </p>
                      <p className="text-xs text-gray-500">{networkName}</p>
                    </div>
                    <Button
                      onClick={disconnectWallet}
                      variant="outline"
                      className="w-full bg-transparent"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Ngắt kết nối
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
