"use client";

import { useState } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  Users,
  Package,
  UserPlus,
  Filter,
  LogOut,
  Shield,
  Edit,
  Trash2,
  Eye,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminGuard from "@/components/AdminGuard";
import type { UserRole } from "@/hooks/useRoleAuth";
import { useUsers, useAssignRole, useRemoveRole, useAdminStats } from "@/hooks/useAdminData";
import { useNFTs } from "@/hooks/useNFTs";
import { Skeleton } from "@/components/ui/skeleton";
import AIAgentPanel from "@/components/AIAgentPanel";
import AIAgentDashboard from "@/components/AIAgentDashboard";
import AIAgentAnalytics from "@/components/AIAgentAnalytics";
import OnChainProposalsPanel from "@/components/OnChainProposalsPanel";
import { getSuiExplorerAddressUrl } from "@/lib/blockchain/config-sui";
import PerformanceMonitor from "@/components/PerformanceMonitor";

// Types for data passed from server
interface UserWithFormatted {
  address: string;
  role: string;
  assigned_at: string;
  formattedAddress?: string;
  assignedAt?: string;
}

interface AdminStats {
  totalNFTs?: number;
  totalUsers: number;
  manufacturers: number;
  distributors: number;
  pharmacies: number;
  admins: number;
}

// Safe wrapper for getPackageId (client-side safe)
function getPackageIdSafe(): string | null {
  try {
    const packageId = process.env.NEXT_PUBLIC_SUI_PACKAGE_ID || '';
    if (!packageId) {
      return null;
    }
    if (packageId.startsWith('0x') && packageId.length === 66) {
      return packageId;
    }
    return packageId.startsWith('0x') ? packageId : `0x${packageId}`;
  } catch {
    return null;
  }
}

interface AdminContentProps {
  initialUsers?: UserWithFormatted[];
  initialStats?: AdminStats;
}

function AdminContent({ initialUsers = [], initialStats }: AdminContentProps) {
  const { logout: adminLogout } = useAdminAuth();
  const [newUserAddress, setNewUserAddress] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [successMessage, setSuccessMessage] = useState("");
  const [editingUser, setEditingUser] = useState<{
    address: string;
    role: UserRole;
  } | null>(null);

  // Sử dụng React Query hooks để fetch dữ liệu với caching
  const { data: usersData, isLoading: isUsersLoading } = useUsers();
  const { data: statsData } = useAdminStats();
  const { data: nftsData, isLoading: isNFTsLoading } = useNFTs();
  const assignRoleMutation = useAssignRole();
  const removeRoleMutation = useRemoveRole();

  const userList = usersData || initialUsers || [];

  // Tính stats từ userList hoặc dùng statsData
  const stats = initialStats || statsData || {
    totalNFTs: 0,
    totalUsers: userList.length,
    manufacturers: userList.filter((u) => u.role === "MANUFACTURER").length,
    distributors: userList.filter((u) => u.role === "DISTRIBUTOR").length,
    pharmacies: userList.filter((u) => u.role === "PHARMACY").length,
    admins: userList.filter((u) => u.role === "ADMIN").length,
  };

  // Hàm xử lý sửa quyền
  const handleEditRole = (address: string, currentRole: UserRole) => {
    setEditingUser({ address, role: currentRole });
    setNewUserAddress(address);
    setNewUserRole(currentRole);
  };

  // Hàm xử lý cấp quyền hoặc cập nhật quyền
  const handleAssignRole = () => {
    if (!newUserAddress || !newUserRole) {
      alert("Vui lòng nhập địa chỉ ví và chọn vai trò");
      return;
    }

    const addressRegex = /^0x[a-fA-F0-9]{40}$|^0x[a-fA-F0-9]{64}$/;
    const trimmedAddress = newUserAddress.trim();
    if (!addressRegex.test(trimmedAddress)) {
      alert("Địa chỉ ví không hợp lệ. Phải là địa chỉ Ethereum (0x + 40 hex) hoặc Sui (0x + 64 hex)");
      return;
    }

    setSuccessMessage("");

    assignRoleMutation.mutate(
      { address: trimmedAddress.toLowerCase(), role: newUserRole },
      {
        onSuccess: (data) => {
          const payload = data.data ?? data;
          const blockchain = payload.blockchain;
          let msg = payload.message || `✅ Đã cấp quyền ${newUserRole} cho địa chỉ ${newUserAddress}`;
          if (blockchain?.synced && blockchain?.tx) {
            msg += `\n🔗 Tx: ${blockchain.tx}`;
          } else if (blockchain?.error) {
            msg += `\n⚠️ Onchain: ${blockchain.error}`;
          }
          setSuccessMessage(msg);
          setNewUserAddress("");
          setNewUserRole(null);
          setEditingUser(null);
          setTimeout(() => setSuccessMessage(""), 8000);
        },
        onError: (error: Error) => {
          alert(error.message || "Có lỗi xảy ra khi kết nối đến server");
        },
      }
    );
  };

  // Hàm xử lý xóa quyền
  const handleRemoveRole = (address: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa quyền của địa chỉ ${address}?`)) return;

    removeRoleMutation.mutate(address, {
      onSuccess: () => {
        setSuccessMessage(`✅ Đã xóa quyền của địa chỉ ${address}`);
        setTimeout(() => setSuccessMessage(""), 3000);
      },
      onError: () => {
        alert("Có lỗi xảy ra khi xóa quyền");
      },
    });
  };

  // Hàm hủy chỉnh sửa
  const handleCancelEdit = () => {
    setEditingUser(null);
    setNewUserAddress("");
    setNewUserRole(null);
  };

  // Hàm lấy màu badge cho vai trò
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

  const handleLogout = () => {
    if (confirm("Bạn có chắc chắn muốn đăng xuất?")) {
      adminLogout();
    }
  };


  const filteredNFTs: any[] = [];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      {/* Header với nút đăng xuất */}
      <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1 md:mb-2">
            Bảng điều khiển hệ thống
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            Quản lý toàn bộ hệ thống PharmaDNA và cấp quyền người dùng
          </p>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-3">
          <Badge className="bg-red-100 text-red-800 text-xs sm:text-sm">
            <Shield className="w-3 h-3 mr-1" />
            Admin
          </Badge>
          <Button variant="outline" onClick={handleLogout} size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Đăng xuất</span>
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalNFTs}
              </div>
              <p className="text-sm text-gray-600">Tổng NFT</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {stats.totalUsers}
              </div>
              <p className="text-sm text-gray-600">Người dùng</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {stats.manufacturers}
              </div>
              <p className="text-sm text-gray-600">Nhà sản xuất</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {stats.distributors}
              </div>
              <p className="text-sm text-gray-600">Nhà phân phối</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {stats.pharmacies}
              </div>
              <p className="text-sm text-gray-600">Nhà thuốc</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="roles" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3">
          <TabsTrigger value="nfts" className="flex items-center">
            <Package className="w-4 h-4 mr-2" />
            Quản lý NFT
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center">
            <Users className="w-4 h-4 mr-2" />
            Người dùng
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center">
            <UserPlus className="w-4 h-4 mr-2" />
            Cấp quyền
          </TabsTrigger>
        </TabsList>

        {/* NFT Management */}
        <TabsContent value="nfts">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                  <CardTitle className="text-base md:text-lg">Danh sách lô thuốc (NFT)</CardTitle>
                  <CardDescription className="text-xs md:text-sm">Tất cả NFT trong hệ thống</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32 md:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      <SelectItem value="manufactured">Đã sản xuất</SelectItem>
                      <SelectItem value="in_transit">
                        Đang vận chuyển
                      </SelectItem>
                      <SelectItem value="in_pharmacy">Tại nhà thuốc</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isNFTsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                  ))}
                </div>
              ) : nftsData && nftsData.length > 0 ? (
                <>
                  {/* Desktop list */}
                  <div className="hidden md:block space-y-3">
                    {nftsData.map((nft: any) => (
                      <div
                        key={nft.id}
                        className="flex items-center justify-between p-3 md:p-4 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-1 md:mb-2">
                            <Package className="w-5 h-5 text-blue-500" />
                            <span className="font-medium text-sm md:text-base">{nft.product_name || nft.batch_number}</span>
                            <Badge className={`text-xs ${nft.status === 'minted' ? 'bg-blue-100 text-blue-800' : nft.status === 'at_distributor' ? 'bg-yellow-100 text-yellow-800' : nft.status === 'at_pharmacy' ? 'bg-green-100 text-green-800' : nft.status === 'dispensed' ? 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-800'}`}>
                              {nft.status || 'unknown'}
                            </Badge>
                          </div>
                          <p className="text-xs md:text-sm text-gray-500">
                            <code className="text-xs bg-gray-100 px-1 rounded">{nft.batch_number}</code>
                            {nft.manufacturer_address && (
                              <span className="ml-2">MFG: {nft.manufacturer_address.slice(0, 8)}...</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400">
                            Created: {new Date(nft.created_at).toLocaleString('vi-VN')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Mobile cards */}
                  <div className="md:hidden space-y-3">
                    {nftsData.map((nft: any) => (
                      <div key={nft.id} className="border rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium text-sm">{nft.product_name || nft.batch_number}</div>
                            <div className="text-xs text-gray-500">{nft.batch_number}</div>
                          </div>
                          <Badge className={`text-xs ${nft.status === 'minted' ? 'bg-blue-100 text-blue-800' : nft.status === 'at_distributor' ? 'bg-yellow-100 text-yellow-800' : nft.status === 'at_pharmacy' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {nft.status || 'unknown'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Chưa có NFT nào trong hệ thống</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Management */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Danh sách người dùng</CardTitle>
              <CardDescription>
                Tất cả người dùng đã được cấp quyền trong hệ thống
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isUsersLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-64" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <div className="flex space-x-2">
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-8 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : userList.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Chưa có người dùng nào được cấp quyền</p>
                </div>
              ) : (
                <>
                  {/* Desktop list */}
                  <div className="hidden md:block space-y-3">
                    {userList.map((user) => (
                      <div
                        key={user.address}
                        className="flex items-center justify-between p-3 md:p-4 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-1 md:mb-2">
                            <code className="text-xs md:text-sm font-mono bg-gray-100 px-2 py-1 rounded break-all">
                              {user.address}
                            </code>
                            <Badge className={getRoleBadgeColor(user.role)}>
                              {user.role}
                            </Badge>
                          </div>
                          <p className="text-xs md:text-sm text-gray-500">
                            Cấp quyền: {user.assignedAt || user.assigned_at}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleEditRole(user.address, user.role as UserRole)
                            }
                            className="bg-transparent"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveRole(user.address)}
                            className="bg-transparent text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Mobile cards */}
                  <div className="md:hidden space-y-3">
                    {userList.map((user) => (
                      <div key={user.address} className="border rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <Badge className={getRoleBadgeColor(user.role)}>
                            {user.role}
                          </Badge>
                        </div>
                        <div className="text-xs font-mono bg-gray-100 px-2 py-1 rounded break-all mb-2">
                          {user.address}
                        </div>
                        <p className="text-xs text-gray-500 mb-2">
                          Cấp quyền: {user.assignedAt || user.assigned_at}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() =>
                              handleEditRole(user.address, user.role as UserRole)
                            }
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Sửa
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-red-600 hover:text-red-700"
                            onClick={() => handleRemoveRole(user.address)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Xóa
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Role Assignment */}
        <TabsContent value="roles">
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <UserPlus className="w-5 h-5 mr-2" />
                  {editingUser ? "Sửa quyền người dùng" : "Cấp quyền mới"}
                </CardTitle>
                <CardDescription>
                  {editingUser
                    ? "Cập nhật vai trò cho người dùng đã có trong hệ thống"
                    : "Thêm người dùng mới vào hệ thống với vai trò cụ thể"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingUser && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <Eye className="w-4 h-4 inline mr-1" />
                      Đang chỉnh sửa quyền cho:{" "}
                      <code className="font-mono">{editingUser.address}</code>
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="userAddress">Địa chỉ ví *</Label>
                  <Input
                    id="userAddress"
                    value={newUserAddress}
                    onChange={(e) => setNewUserAddress(e.target.value)}
                    placeholder="0x..."
                    className="font-mono"
                    disabled={!!editingUser}
                  />
                </div>

                <div>
                  <Label htmlFor="userRole">Vai trò *</Label>
                  <Select
                    value={newUserRole || ""}
                    onValueChange={(value) => setNewUserRole(value as UserRole)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn vai trò" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANUFACTURER">
                        Manufacturer (Nhà sản xuất)
                      </SelectItem>
                      <SelectItem value="DISTRIBUTOR">
                        Distributor (Nhà phân phối)
                      </SelectItem>
                      <SelectItem value="PHARMACY">
                        Pharmacy (Nhà thuốc)
                      </SelectItem>
                      <SelectItem value="ADMIN">
                        Admin (Quản trị viên)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {successMessage && (
                  <div className={`p-3 border rounded-lg ${
                    successMessage.includes('thất bại') || successMessage.includes('chưa đồng bộ')
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-green-50 border-green-200'
                  }`}>
                    <p className={`text-sm ${
                      successMessage.includes('thất bại') || successMessage.includes('chưa đồng bộ')
                        ? 'text-yellow-800'
                        : 'text-green-800'
                    }`}>
                      {successMessage}
                    </p>
                    {successMessage.includes('thất bại') && (
                      <div className="mt-2 text-xs text-yellow-700">
                        <p className="font-semibold">Có thể thử lại:</p>
                        <p>Gọi API POST /api/admin/sync-role với body: {`{ "address": "${newUserAddress}" }`}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex space-x-2">
                  <Button
                    onClick={handleAssignRole}
                    disabled={!newUserAddress || !newUserRole || assignRoleMutation.isPending}
                    className="flex-1"
                  >
                    {assignRoleMutation.isPending
                      ? "Đang xử lý..."
                      : editingUser
                      ? "Cập nhật quyền"
                      : "Cấp quyền"}
                  </Button>

                  {editingUser && (
                    <Button
                      variant="outline"
                      onClick={handleCancelEdit}
                      className="bg-transparent"
                    >
                      Hủy
                    </Button>
                  )}
                </div>

                <div className="text-sm text-gray-500 space-y-1">
                  <p>
                    <strong>Manufacturer:</strong> Có thể tạo NFT mới
                  </p>
                  <p>
                    <strong>Distributor:</strong> Có thể nhận và vận chuyển NFT
                  </p>
                  <p>
                    <strong>Pharmacy:</strong> Có thể xác nhận nhập kho
                  </p>
                  <p>
                    <strong>Admin:</strong> Có thể quản lý toàn bộ hệ thống
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Cài đặt hệ thống
                </CardTitle>
                <CardDescription>
                  Các tùy chọn cấu hình hệ thống
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Contract Address:</span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {process.env.NEXT_PUBLIC_PHARMA_NFT_ADDRESS ||
                        "Contract Address"}
                    </code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Network:</span>
                    <Badge variant="outline">Sui Network</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">IPFS Gateway:</span>
                    <Badge variant="outline">ipfs.io</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Admin Session:</span>
                    <Badge className="bg-green-100 text-green-800">
                      Đang hoạt động
                    </Badge>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <Button
                    variant="outline"
                    className="w-full bg-transparent"
                    size="sm"
                    onClick={() => {
                      try {
                        if (typeof window !== 'undefined') {
                          const contractAddress =
                            process.env.NEXT_PUBLIC_SUI_PACKAGE_ID ||
                            process.env.NEXT_PUBLIC_SUI_CONTRACT_OBJECT_ID ||
                            getPackageIdSafe() ||
                            "0x";
                          window.open(
                            getSuiExplorerAddressUrl(contractAddress),
                            "_blank"
                          );
                        }
                      } catch (error) {
                        console.error('Error opening explorer:', error);
                      }
                    }}
                  >
                    Xem Contract trên Explorer
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full bg-transparent"
                    size="sm"
                  >
                    Backup dữ liệu
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full bg-transparent"
                    size="sm"
                  >
                    Xuất báo cáo
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Bảng quản lý người dùng ở dưới cùng */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Quản lý người dùng hệ thống
          </CardTitle>
          <CardDescription>
            Danh sách tất cả người dùng được cấp quyền và các thao tác quản lý
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isUsersLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : userList.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">
                Chưa có người dùng nào
              </h3>
              <p className="text-sm">
                Hãy cấp quyền cho người dùng đầu tiên ở tab "Cấp quyền" bên trên
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-4 font-medium text-gray-900">
                      STT
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900">
                      Địa chỉ ví
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900">
                      Vai trò
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900">
                      Quyền hạn
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900">
                      Ngày cấp
                    </th>
                    <th className="text-center p-4 font-medium text-gray-900">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {userList.map((user, index) => (
                    <tr
                      key={user.address}
                      className="border-b hover:bg-gray-50 transition-colors"
                    >
                      <td className="p-4 text-sm">{index + 1}</td>
                      <td className="p-4">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
                          {user.address}
                        </code>
                      </td>
                      <td className="p-4">
                        <Badge className={getRoleBadgeColor(user.role)}>
                          {user.role}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {user.role === "ADMIN" && "Toàn quyền hệ thống"}
                        {user.role === "MANUFACTURER" && "Tạo lô thuốc"}
                        {user.role === "DISTRIBUTOR" && "Quản lý vận chuyển"}
                        {user.role === "PHARMACY" && "Xác nhận nhập kho"}
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {user.assignedAt || user.assigned_at}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleEditRole(user.address, user.role as UserRole)
                            }
                            className="bg-transparent text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Sửa
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveRole(user.address)}
                            className="bg-transparent text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Xóa
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Thống kê nhanh */}
          <div className="mt-4 md:mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 pt-4 md:pt-6 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {userList.filter((u) => u.role === "ADMIN").length}
              </div>
              <p className="text-sm text-gray-600">Admin</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {userList.filter((u) => u.role === "MANUFACTURER").length}
              </div>
              <p className="text-sm text-gray-600">Nhà sản xuất</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {userList.filter((u) => u.role === "DISTRIBUTOR").length}
              </div>
              <p className="text-sm text-gray-600">Nhà phân phối</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {userList.filter((u) => u.role === "PHARMACY").length}
              </div>
              <p className="text-sm text-gray-600">Nhà thuốc</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Agent Dashboard */}
      <div className="mt-8">
        <AIAgentDashboard />
      </div>

      {/* AI Agent Analytics */}
      <div className="mt-8">
        <AIAgentAnalytics />
      </div>

      {/* AI Agent Panel */}
      <div className="mt-8">
        <AIAgentPanel
          role="admin"
          context={{ userList, stats }}
        />
      </div>

      {/* AI On-chain Proposals */}
      <div className="mt-8">
        <OnChainProposalsPanel />
      </div>

      {/* Performance Monitor (Dev Only) */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-8">
          <PerformanceMonitor />
        </div>
      )}
    </div>
  );
}

interface AdminPageProps {
  // Server-side data will be passed as props
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default function AdminPage({ searchParams }: AdminPageProps) {
  // This is a Server Component that can fetch data and pass to client component
  // The actual rendering happens in AdminContent which is wrapped by AdminGuard

  return (
    <ErrorBoundary>
      <AdminGuard>
        <AdminContent />
      </AdminGuard>
    </ErrorBoundary>
  );
}
