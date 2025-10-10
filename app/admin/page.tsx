"use client";

import { useState, useEffect } from "react";
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
// Thêm import cho các icon mới
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
import RoleGuard from "@/components/RoleGuard";

function AdminContent() {
  // Thêm state mới cho quản lý người dùng
  const { logout: adminLogout } = useAdminAuth();
  const [newUserAddress, setNewUserAddress] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAssigning, setIsAssigning] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [editingUser, setEditingUser] = useState<{
    address: string;
    role: UserRole;
  } | null>(null);
  const [userList, setUserList] = useState<any[]>([]);

  // Lấy danh sách user từ API
  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin");
      const data = await res.json();
      setUserList(data);
    } catch (error) {
      setUserList([]);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [successMessage]);

  // Thêm hàm xử lý sửa quyền
  const handleEditRole = (address: string, currentRole: UserRole) => {
    setEditingUser({ address, role: currentRole });
    setNewUserAddress(address);
    setNewUserRole(currentRole);
  };

  // Hàm xử lý cấp quyền hoặc cập nhật quyền
  const handleAssignRole = async () => {
    if (!newUserAddress || !newUserRole) return;
    setIsAssigning(true);
    setSuccessMessage("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: newUserAddress, role: newUserRole }),
      });
      if (!res.ok) throw new Error("Lỗi khi cấp/cập nhật quyền");
      const action = editingUser ? "cập nhật" : "cấp";
      setSuccessMessage(
        `✅ Đã ${action} quyền ${newUserRole} cho địa chỉ ${newUserAddress}`
      );
      setNewUserAddress("");
      setNewUserRole(null);
      setEditingUser(null);
      fetchUsers();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      alert(error.message || "Có lỗi xảy ra");
    } finally {
      setIsAssigning(false);
    }
  };

  // Hàm xử lý xóa quyền
  const handleRemoveRole = async (address: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa quyền của địa chỉ ${address}?`)) {
      return;
    }
    try {
      const res = await fetch("/api/admin", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!res.ok) throw new Error("Lỗi khi xóa quyền");
      setSuccessMessage(`✅ Đã xóa quyền của địa chỉ ${address}`);
      fetchUsers();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      alert(error.message || "Có lỗi xảy ra khi xóa quyền");
    }
  };

  // Thêm hàm hủy chỉnh sửa
  const handleCancelEdit = () => {
    setEditingUser(null);
    setNewUserAddress("");
    setNewUserRole(null);
  };

  // Thêm hàm lấy màu badge cho vai trò
  const getRoleBadgeColor = (role: UserRole) => {
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

  const stats = {
    totalNFTs: 0,
    totalUsers: userList.length,
    manufacturers: userList.filter((user) => user.role === "MANUFACTURER")
      .length,
    distributors: userList.filter((user) => user.role === "DISTRIBUTOR").length,
    pharmacies: userList.filter((user) => user.role === "PHARMACY").length,
  };

  // Xóa filteredNFTs, thay thế bằng mảng rỗng hoặc logic phù hợp
  // const filteredNFTs = statusFilter === "all" ? mockNFTs : mockNFTs.filter((nft) => nft.status === statusFilter)
  const filteredNFTs: any[] = [];

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header với nút đăng xuất */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Bảng điều khiển hệ thống
          </h1>
          <p className="text-gray-600">
            Quản lý toàn bộ hệ thống PharmaDNA và cấp quyền người dùng
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge className="bg-red-100 text-red-800">
            <Shield className="w-3 h-3 mr-1" />
            Admin
          </Badge>
          <Button variant="outline" onClick={handleLogout} size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Đăng xuất
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
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
        <TabsList className="grid w-full grid-cols-3">
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
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Danh sách lô thuốc (NFT)</CardTitle>
                  <CardDescription>Tất cả NFT trong hệ thống</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
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
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Chưa có NFT nào trong hệ thống</p>
              </div>
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
              {userList.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Chưa có người dùng nào được cấp quyền</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {userList.map((user) => (
                    <div
                      key={user.address}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                            {user.address}
                          </code>
                          <Badge className={getRoleBadgeColor(user.role)}>
                            {user.role}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500">
                          Được cấp quyền: {user.assignedAt}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleEditRole(user.address, user.role)
                          }
                          className="bg-transparent"
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
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Role Assignment */}
        <TabsContent value="roles">
          <div className="grid lg:grid-cols-2 gap-6">
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
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">{successMessage}</p>
                  </div>
                )}

                <div className="flex space-x-2">
                  <Button
                    onClick={handleAssignRole}
                    disabled={!newUserAddress || !newUserRole || isAssigning}
                    className="flex-1"
                  >
                    {isAssigning
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
                      0xaa3f88a6b613985f3D97295D6BAAb6246c2699c6
                    </code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Network:</span>
                    <Badge variant="outline">PharmaDNA Chainlet</Badge>
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
                    onClick={() =>
                      window.open(
                        `https://pharmadna-2759821881746000-1.sagaexplorer.io/address/0xaa3f88a6b613985f3D97295D6BAAb6246c2699c6`,
                        "_blank"
                      )
                    }
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
          {userList.length === 0 ? (
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
                        {user.assignedAt}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleEditRole(user.address, user.role)
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
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t">
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
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminGuard>
      <AdminContent />
    </AdminGuard>
  );
}
