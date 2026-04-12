"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu, X, Wallet, LogOut, AlertTriangle, Shield } from "lucide-react";
import { useWalletSui as useWallet } from "@/hooks/useWalletSui";
import { useRoleAuth } from "@/hooks/useRoleAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { ConnectModal } from "@mysten/wallet-kit";
import NotificationBadge from "@/components/NotificationBadge";
import {
  prefetchManufacturerData,
  prefetchDistributorData,
  prefetchPharmacyData,
  prefetchAdminData,
  prefetchForUserRole,
} from "@/hooks/usePrefetchData";
import { useQueryClient } from "@tanstack/react-query";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const isScrolled = useRef(false);
  const {
    account,
    isConnected,
    isConnecting,
    networkName,
    isCorrectNetwork,
    walletType,
    availableWallets,
    connectWallet,
    disconnectWallet,
    switchToTargetNetwork,
    showConnectModal,
    setShowConnectModal,
  } = useWallet();

  const { userRole, roleName, checkUserRole } = useRoleAuth();
  const { isAuthenticated: isAdminAuthenticated, logout: adminLogout } =
    useAdminAuth();
  const queryClient = useQueryClient();

  // Prefetch handlers cho navigation hover
  const handlePrefetchManufacturer = useCallback(() => {
    prefetchManufacturerData(queryClient, account || undefined);
  }, [queryClient, account]);

  const handlePrefetchDistributor = useCallback(() => {
    prefetchDistributorData(queryClient, account || undefined);
  }, [queryClient, account]);

  const handlePrefetchPharmacy = useCallback(() => {
    prefetchPharmacyData(queryClient, account || undefined);
  }, [queryClient, account]);

  const handlePrefetchAdmin = useCallback(() => {
    prefetchAdminData(queryClient);
  }, [queryClient]);

  // Debug: Log khi showConnectModal thay đổi
  useEffect(() => {
    console.log('[Header] showConnectModal changed:', showConnectModal);
  }, [showConnectModal]);

  // Lắng nghe cập nhật role và refresh lại
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleRoleUpdate = () => {
      console.log('[Header] Role updated event received, refreshing...');
      // Force refresh to avoid cache
      checkUserRole(true);
    };

    try {
      window.addEventListener("roleUpdated", handleRoleUpdate);
      return () => {
        try {
          window.removeEventListener("roleUpdated", handleRoleUpdate);
        }catch (error) {
          // Ignore cleanup errors
        }
      };
    } catch (error) {
      // Ignore if window is not available
      return () => {};
    }
  }, [checkUserRole]);

  // Debug log role changes
  useEffect(() => {
    console.log('[Header] userRole changed:', userRole, 'roleName:', roleName);
  }, [userRole, roleName]);

  // Hide header on scroll down, show on scroll up
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollingDown = currentScrollY > lastScrollY.current;

      // Only toggle after scrolling more than 50px from top
      if (currentScrollY > 80) {
        if (scrollingDown && isVisible) {
          setIsVisible(false);
        } else if (!scrollingDown && !isVisible) {
          setIsVisible(true);
        }
      } else {
        // Always show when near top
        if (!isVisible) setIsVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isVisible]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getRoleBadgeColor = (role: string | null) => {
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
    <header
      className={`bg-white shadow-sm border-b border-blue-200 fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
      style={{
        boxShadow: '0 0 8px 0 rgba(59, 130, 246, 0.4), 0 0 2px 0 rgba(59, 130, 246, 0.2)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="text-2xl font-bold text-blue-600">
              PharmaDNA (Sui)
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

            <Link
              href="/manufacturer"
              className="text-gray-700 hover:text-blue-600 transition-colors"
              onMouseEnter={handlePrefetchManufacturer}
            >
              Nhà sản xuất
            </Link>

            <Link
              href="/distributor"
              className="text-gray-700 hover:text-blue-600 transition-colors"
              onMouseEnter={handlePrefetchDistributor}
            >
              Nhà phân phối
            </Link>

            <Link
              href="/pharmacy"
              className="text-gray-700 hover:text-blue-600 transition-colors"
              onMouseEnter={handlePrefetchPharmacy}
            >
              Nhà thuốc
            </Link>

            <Link
              href="/lookup"
              className="text-gray-700 hover:text-blue-600 transition-colors"
            >
              Tra cứu
            </Link>

            <Link
              href="/admin"
              className="text-gray-700 hover:text-blue-600 transition-colors"
              onMouseEnter={handlePrefetchAdmin}
            >
              Admin
            </Link>
          </nav>

                 {/* Wallet Connect Button */}
                 <div className="hidden md:flex items-center space-x-3">
                   {isConnected && userRole && (
                     <>
                       <NotificationBadge />
                       <Badge className={getRoleBadgeColor(userRole)}>
                         <Shield className="w-3 h-3 mr-1" />
                         {roleName}
                       </Badge>
                     </>
                   )}

                   {!isConnected ? (
              <Button 
                onClick={() => {
                  console.log('[Header] Button clicked, calling connectWallet');
                  connectWallet();
                }} 
                disabled={isConnecting}
              >
                <Wallet className="w-4 h-4 mr-2" />
                {isConnecting ? "Đang kết nối..." : availableWallets.length > 0 ? `Kết nối ví (${availableWallets.length})` : "Kết nối ví"}
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
                    <p className="text-sm font-medium">Loại ví</p>
                    <p className="text-xs text-gray-500">{walletType || "Unknown"}</p>
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium">Vai trò</p>
                    <Badge
                      className={`text-xs ${getRoleBadgeColor(userRole)}`}
                    >
                      {roleName}
                    </Badge>
                    {!userRole && (
                      <p className="text-xs text-yellow-600 mt-1">Chưa được cấp quyền</p>
                    )}
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium">Mạng</p>
                    <p className="text-xs text-gray-500">{networkName}</p>
                  </div>
                  {!isCorrectNetwork && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={switchToTargetNetwork}>
                        Chuyển sang {networkName || "đúng mạng"}
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
          <div className="md:hidden flex items-center gap-2">
            {/* Wallet status indicator on mobile */}
            {isConnected && (
              <div className="flex items-center gap-1.5 mr-1">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-xs font-mono text-gray-600 hidden sm:block">{formatAddress(account!)}</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="min-w-[44px] min-h-[44px]"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t shadow-lg">
            <div className="px-2 pt-2 pb-4 space-y-0.5">
              {[
                { href: "/", label: "Trang chủ" },
                { href: "/manufacturer", label: "Nhà sản xuất", prefetch: handlePrefetchManufacturer },
                { href: "/distributor", label: "Nhà phân phối", prefetch: handlePrefetchDistributor },
                { href: "/pharmacy", label: "Nhà thuốc", prefetch: handlePrefetchPharmacy },
                { href: "/lookup", label: "Tra cứu", highlight: true },
                { href: "/admin", label: "Admin", prefetch: handlePrefetchAdmin },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  onMouseEnter={item.prefetch}
                  className={`block px-4 py-3 text-sm sm:text-base rounded-lg mx-1 transition-colors ${
                    item.highlight
                      ? "text-blue-600 font-semibold bg-blue-50"
                      : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                  }`}
                >
                  {item.label}
                </Link>
              ))}

              <div className="px-3 pt-3 mt-2 border-t space-y-3">
                {isConnected && userRole && (
                  <div className="flex items-center gap-2 px-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <Badge className={`${getRoleBadgeColor(userRole)}`}>
                      <Shield className="w-3 h-3 mr-1" />
                      {roleName}
                    </Badge>
                  </div>
                )}

                {!isConnected ? (
                  <Button
                    onClick={() => {
                      setIsMenuOpen(false);
                      connectWallet();
                    }}
                    disabled={isConnecting}
                    className="w-full min-h-[48px] text-sm sm:text-base"
                    size="lg"
                  >
                    <Wallet className="w-5 h-5 mr-2" />
                    {isConnecting ? "Đang kết nối..." : availableWallets.length > 0 ? `Kết nối ví (${availableWallets.length})` : "Kết nối ví"}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <p className="text-sm font-mono text-gray-700 font-medium">
                          {formatAddress(account!)}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500">{networkName}</p>
                      {userRole && (
                        <p className="text-xs text-blue-600 mt-2 font-medium">
                          Vai trò: {roleName}
                        </p>
                      )}
                      {!userRole && (
                        <p className="text-xs text-yellow-600 mt-2 font-medium">
                          Chưa được cấp quyền
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={() => {
                        setIsMenuOpen(false);
                        disconnectWallet();
                      }}
                      variant="outline"
                      className="w-full min-h-[44px] bg-transparent text-sm"
                      size="lg"
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

      {/* Connect Modal - Phải render bên trong WalletKitProvider context */}
      {showConnectModal && (
        <ConnectModal 
          open={true} 
          onClose={() => {
            console.log('[Header] ConnectModal onClose called');
            setShowConnectModal(false);
          }} 
        />
      )}
    </header>
  );
}
