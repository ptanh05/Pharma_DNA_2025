"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
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
  TrendingUp,
  Server,
  Zap,
  Clock,
  Globe,
  BarChart3,
  ArrowUpRight,
  CheckCircle,
  RefreshCw,
  Bot,
  LayoutDashboard,
  FileText,
  Check,
  X,
  Pill,
  ExternalLink,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminGuard from "@/components/AdminGuard";
import type { UserRole } from "@/hooks/useRoleAuth";
import { useAssignRole, useRemoveRole, useUpdateUserInfo, useAdminDashboard, useUserStats, type UpdateUserInfoData } from "@/hooks/useAdminData";
import { useNFTs } from "@/hooks/useNFTs";
import { useRegistrations, useReviewRegistration, type Registration } from "@/hooks/useRegistration";
import { Skeleton } from "@/components/ui/skeleton";
import AIAgentPanel from "@/components/AIAgentPanel";
import AIAgentDashboard from "@/components/AIAgentDashboard";
import AIAgentAnalytics from "@/components/AIAgentAnalytics";
import OnChainProposalsPanel from "@/components/OnChainProposalsPanel";
import { getSuiExplorerAddressUrl } from "@/lib/blockchain/config-sui";
import PerformanceMonitor from "@/components/PerformanceMonitor";
import RestoreButton from "@/components/admin/RestoreButton";
import {
  LineChart as RechartsLineChart,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import SupplyChainFunnelChart from "@/components/SupplyChainFunnelChart";
import ActivityHeatmap from "@/components/ActivityHeatmap";

// Types for data passed from server
interface UserWithFormatted {
  address: string;
  role: string;
  assigned_at: string;
  formattedAddress?: string;
  assignedAt?: string;
  company_name?: string;
  license_number?: string;
  license_ipfs_hash?: string;
  tax_id?: string;
  contact_email?: string;
  contact_phone?: string;
  company_address?: string;
  notes?: string;
}

interface AdminStats {
  totalNFTs?: number;
  nft?: {
    minted: number;
    at_distributor: number;
    at_pharmacy: number;
    dispensed: number;
  };
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

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isRecentDate(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000; // within 7 days
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
  const [editingInfoUser, setEditingInfoUser] = useState<UserWithFormatted | null>(null);
  const [infoForm, setInfoForm] = useState({
    company_name: "",
    license_number: "",
    tax_id: "",
    contact_email: "",
    contact_phone: "",
    company_address: "",
    notes: "",
  });

  // Sử dụng 1 hook DUY NHẤT useAdminDashboard — tránh cache key conflict
  const [usersPage, setUsersPage] = useState(1);
  const { data: dashboardData, isLoading: isDashboardLoading } = useAdminDashboard(usersPage, 4);
  const { data: nftsData, isLoading: isNFTsLoading } = useNFTs();
  const assignRoleMutation = useAssignRole();
  const removeRoleMutation = useRemoveRole();
  const updateUserInfoMutation = useUpdateUserInfo();

  const userList = dashboardData?.users ?? [];
  const totalUsers = dashboardData?.totalUsers ?? userList.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / 4));

  // Stats từ unified hook (đã bao gồm NFT count nếu có token)
  const { data: userStats } = useUserStats();
  const stats = dashboardData?.stats ?? initialStats ?? {
    totalNFTs: 0,
    totalUsers: userStats?.totalUsers ?? userList.length,
    manufacturers: userStats?.manufacturers ?? userList.filter((u) => u.role === "MANUFACTURER").length,
    distributors: userStats?.distributors ?? userList.filter((u) => u.role === "DISTRIBUTOR").length,
    pharmacies: userStats?.pharmacies ?? userList.filter((u) => u.role === "PHARMACY").length,
    admins: userStats?.admins ?? userList.filter((u) => u.role === "ADMIN").length,
  };

  const totalNFTs = stats.totalNFTs ?? 0;
  const recentTransactions = dashboardData?.recentTransactions ?? [];

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

  // Mở modal sửa thông tin công ty
  const handleEditUserInfo = (user: UserWithFormatted) => {
    setEditingInfoUser(user);
    setInfoForm({
      company_name: user.company_name || "",
      license_number: user.license_number || "",
      tax_id: user.tax_id || "",
      contact_email: user.contact_email || "",
      contact_phone: user.contact_phone || "",
      company_address: (user as any).company_address || "",
      notes: (user as any).notes || "",
    });
  };

  // Lưu thông tin công ty
  const handleSaveUserInfo = () => {
    if (!editingInfoUser) return;
    updateUserInfoMutation.mutate(
      { address: editingInfoUser.address, ...infoForm },
      {
        onSuccess: () => {
          toast.success("Đã cập nhật thông tin người dùng");
          setEditingInfoUser(null);
          setInfoForm({ company_name: "", license_number: "", tax_id: "", contact_email: "", contact_phone: "", company_address: "", notes: "" });
        },
        onError: (error: Error) => {
          toast.error(error.message || "Cập nhật thất bại");
        },
      }
    );
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


  const filteredNFTs: any[] = (() => {
    if (!nftsData || !Array.isArray(nftsData)) return [];
    if (statusFilter === "all") return nftsData;
    return nftsData.filter((nft: any) => {
      if (statusFilter === "minted") return nft.status === "minted";
      if (statusFilter === "in_transit") return nft.status === "at_distributor";
      if (statusFilter === "at_pharmacy") return nft.status === "at_pharmacy";
      return true;
    });
  })();

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      {/* Header với nút đăng xuất */}
      <div className="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
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
          <Button variant="outline" onClick={handleLogout} size="sm" aria-label="Đăng xuất">
            <LogOut className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Đăng xuất</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="bg-gray-100/80 rounded-xl p-1 flex flex-row flex-nowrap justify-evenly gap-2">
          <TabsTrigger value="dashboard" className="flex items-center flex-shrink-0 min-h-[52px] rounded-lg px-4 py-2.5 gap-2">
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
            <span className="sm:hidden text-xs">Dash</span>
          </TabsTrigger>
          <TabsTrigger value="nfts" className="flex items-center flex-shrink-0 min-h-[52px] rounded-lg px-4 py-2.5 gap-2">
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">NFT</span>
            <span className="sm:hidden text-xs">Lô</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center flex-shrink-0 min-h-[52px] rounded-lg px-4 py-2.5 gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Người dùng</span>
            <span className="sm:hidden text-xs">User</span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center flex-shrink-0 min-h-[52px] rounded-lg px-4 py-2.5 gap-2">
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Cấp quyền</span>
            <span className="sm:hidden text-xs">Quyền</span>
          </TabsTrigger>
          <TabsTrigger value="ai-agent" className="flex items-center flex-shrink-0 min-h-[52px] rounded-lg px-4 py-2.5 gap-2">
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline">AI Agent</span>
            <span className="sm:hidden text-xs">AI</span>
          </TabsTrigger>
          <TabsTrigger value="registrations" className="flex items-center flex-shrink-0 min-h-[52px] rounded-lg px-4 py-2.5 gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Đơn đăng ký</span>
            <span className="sm:hidden text-xs">Đơn</span>
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* KPI Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Tổng NFTs</p>
                    <div className="text-2xl font-bold text-gray-900">{totalNFTs}</div>
                    <p className="text-xs text-gray-400 mt-1 flex items-center">
                      <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
                      NFT trong hệ thống
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Package className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Người dùng</p>
                    <div className="text-2xl font-bold text-gray-900">{stats.totalUsers}</div>
                    <p className="text-xs text-gray-400 mt-1 flex items-center">
                      <ArrowUpRight className="w-3 h-3 mr-1 text-green-500" />
                      {stats.totalUsers > 0 ? "+" : ""}{stats.totalUsers} đã cấp quyền
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Nhà sản xuất</p>
                    <div className="text-2xl font-bold text-gray-900">{stats.manufacturers}</div>
                    <p className="text-xs text-gray-400 mt-1 flex items-center">
                      <ArrowUpRight className="w-3 h-3 mr-1 text-blue-500" />
                      Có thể mint NFT
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Server className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Nhà phân phối</p>
                    <div className="text-2xl font-bold text-gray-900">{stats.distributors}</div>
                    <p className="text-xs text-gray-400 mt-1 flex items-center">
                      <ArrowUpRight className="w-3 h-3 mr-1 text-green-500" />
                      Vận chuyển NFT
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Zap className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Nhà thuốc</p>
                    <div className="text-2xl font-bold text-gray-900">{stats.pharmacies}</div>
                    <p className="text-xs text-gray-400 mt-1 flex items-center">
                      <ArrowUpRight className="w-3 h-3 mr-1 text-green-500" />
                      Bán thuốc
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <Pill className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* NFT Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Phân bổ NFT theo trạng thái
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isDashboardLoading ? (
                  <div className="h-[220px] flex items-center justify-center">
                    <Skeleton className="h-full w-full rounded-xl" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={[
                        { name: "Minted", value: Number(stats.nft?.minted ?? 0), fill: "#3b82f6" },
                        { name: "Vận chuyển", value: Number(stats.nft?.at_distributor ?? 0), fill: "#f59e0b" },
                        { name: "Tại nhà thuốc", value: Number(stats.nft?.at_pharmacy ?? 0), fill: "#10b981" },
                        { name: "Đã bán", value: Number(stats.nft?.dispensed ?? 0), fill: "#8b5cf6" },
                      ]}
                      margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* User Role Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Phân bổ người dùng theo vai trò
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isDashboardLoading ? (
                  <div className="h-[220px] flex items-center justify-center">
                    <Skeleton className="h-full w-full rounded-xl" />
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={[
                          { name: "MFG", label: "Nhà SX", value: stats.manufacturers, fill: "#3b82f6" },
                          { name: "DIST", label: "Phân phối", value: stats.distributors, fill: "#10b981" },
                          { name: "PHR", label: "Nhà thuốc", value: stats.pharmacies, fill: "#f59e0b" },
                          { name: "ADM", label: "Admin", value: stats.admins, fill: "#ef4444" },
                        ]}
                        layout="vertical"
                        margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={40} />
                        <Tooltip formatter={(value: number) => [`${value} người`, 'Số lượng']} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, formatter: (value: number) => value > 0 ? value : '' }} />
                      </BarChart>
                    </ResponsiveContainer>
                    {(stats.manufacturers === 0 && stats.distributors === 0 && stats.pharmacies === 0 && stats.admins === 0) && (
                      <p className="text-center text-gray-400 text-xs mt-2">Chưa có dữ liệu người dùng</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Supply Chain Funnel */}
            <SupplyChainFunnelChart data={stats.nft ?? {}} isLoading={isDashboardLoading} />
          </div>

          {/* Activity Heatmap */}
          <ActivityHeatmap />

          {/* Blockchain Status + Recent Activity + Quick Actions */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Blockchain Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center">
                  <Globe className="w-4 h-4 mr-2" />
                  Blockchain Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Network</span>
                  <Badge className="bg-green-100 text-green-800">Sui Testnet</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Contract</span>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {getPackageIdSafe()?.slice(0, 12) || "N/A"}...
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">NFTs On-chain</span>
                  <span className="text-sm font-semibold">{totalNFTs}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Explorer</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700"
                    onClick={() => {
                      const pkg = getPackageIdSafe() || "0x";
                      window.open(getSuiExplorerAddressUrl(pkg), "_blank");
                    }}
                  >
                    View on Explorer <ArrowUpRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
                <div className="border-t pt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">IPFS Gateway</span>
                    <Badge variant="outline" className="text-xs">ipfs.io</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Database</span>
                    <Badge className="bg-green-100 text-green-800 text-xs">Connected</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Hoạt động gần đây
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[240px] overflow-y-auto">
                  {(recentTransactions).slice(0, 6).map((tx: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 text-xs">
                      <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${tx.status === 'minted' ? 'bg-blue-500' : tx.status === 'at_distributor' ? 'bg-yellow-500' : tx.status === 'at_pharmacy' ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{tx.batch_number || `NFT #${tx.id}`}</p>
                        <p className="text-gray-500">{tx.status?.replace('_', ' ')}</p>
                        <p className="text-gray-400">{tx.updated_at ? new Date(tx.updated_at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}</p>
                      </div>
                    </div>
                  ))}
                  {recentTransactions.length === 0 && (
                    <div className="text-center py-6 text-gray-400">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">Chưa có hoạt động</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center">
                  <Zap className="w-4 h-4 mr-2" />
                  Thao tác nhanh
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start text-sm bg-transparent"
                  onClick={() => {
                    const tabsTrigger = document.querySelector('[value="roles"]') as HTMLElement;
                    tabsTrigger?.click();
                  }}
                >
                  <UserPlus className="w-4 h-4 mr-2 text-blue-600" />
                  Cấp quyền người dùng
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-sm bg-transparent"
                  onClick={() => {
                    const tabsTrigger = document.querySelector('[value="nfts"]') as HTMLElement;
                    tabsTrigger?.click();
                  }}
                >
                  <Package className="w-4 h-4 mr-2 text-green-600" />
                  Xem danh sách NFT
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-sm bg-transparent"
                  onClick={() => {
                    const tabsTrigger = document.querySelector('[value="ai-agent"]') as HTMLElement;
                    tabsTrigger?.click();
                  }}
                >
                  <Bot className="w-4 h-4 mr-2 text-purple-600" />
                  Giao việc cho AI Agent
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-sm bg-transparent"
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/admin/export?format=json", {
                        credentials: "include",
                      });
                      if (!res.ok) throw new Error("Export failed");
                      const blob = await res.blob();
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `pharmadna-export-${new Date().toISOString().split("T")[0]}.json`;
                      a.click();
                    } catch { alert("Xuất báo cáo thất bại"); }
                  }}
                >
                  <TrendingUp className="w-4 h-4 mr-2 text-orange-600" />
                  Xuất báo cáo
                </Button>
                <div className="border-t pt-2 mt-2">
                  <p className="text-xs text-gray-500 mb-2">System Health</p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span>API</span>
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-3 h-3" /> Online
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>Database</span>
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-3 h-3" /> Connected
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

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
                      <SelectItem value="minted">Đã mint</SelectItem>
                      <SelectItem value="in_transit">
                        Đang vận chuyển
                      </SelectItem>
                      <SelectItem value="at_pharmacy">Tại nhà thuốc</SelectItem>
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
              ) : filteredNFTs.length > 0 ? (
                <>
                  {/* Desktop list */}
                  <div className="hidden md:block space-y-3">
                    {filteredNFTs.map((nft: any, i: number) => (
                      <div
                        key={nft.id}
                        className="flex items-center justify-between p-3 md:p-4 border rounded-lg hover:bg-gray-50 animate-fade-in-up"
                        style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}
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
                    {filteredNFTs.map((nft: any) => (
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
              {isDashboardLoading ? (
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
                    {userList.map((user, i) => (
                      <div
                        key={user.address}
                        className="flex items-center justify-between p-3 md:p-4 border rounded-lg hover:bg-gray-50 animate-fade-in-up"
                        style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}
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
                          {user.company_name && (
                            <p className="text-xs md:text-sm font-medium text-gray-700 mb-0.5">
                              {user.company_name}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs md:text-sm text-gray-500">
                            {user.license_number && <span>GP: {user.license_number}</span>}
                            {user.contact_email && <span>{user.contact_email}</span>}
                            <span>Cấp quyền: {formatDate(user.assignedAt || user.assigned_at)}
                            {isRecentDate(user.assignedAt || user.assigned_at) && (
                              <Badge variant="outline" className="text-[10px] ml-1 border-green-200 bg-green-50 text-green-600">Mới</Badge>
                            )}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleEditRole(user.address, user.role as UserRole)
                            }
                            className="bg-transparent"
                            aria-label="Sửa quyền"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditUserInfo(user)}
                            className="bg-transparent text-green-600 hover:text-green-700 hover:bg-green-50"
                            aria-label="Sửa thông tin"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveRole(user.address)}
                            className="bg-transparent text-red-600 hover:text-red-700 hover:bg-red-50"
                            aria-label="Xóa quyền"
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
                        <div className="text-xs font-mono bg-gray-100 px-2 py-1 rounded break-all mb-1">
                          {user.address}
                        </div>
                        {user.company_name && (
                          <p className="text-xs font-medium text-gray-700 mb-1">{user.company_name}</p>
                        )}
                        <div className="text-xs text-gray-500 mb-2">
                          {user.license_number && <span>GP: {user.license_number}</span>}
                          {user.license_number && user.contact_email && <span> | </span>}
                          {user.contact_email && <span>{user.contact_email}</span>}
                          {user.contact_email && user.contact_phone && <span> | </span>}
                          {user.contact_phone && <span>{user.contact_phone}</span>}
                          {(user.license_number || user.contact_email || user.contact_phone) && <span><br /></span>}
                          Cấp quyền: {formatDate(user.assignedAt || user.assigned_at)}
                          {isRecentDate(user.assignedAt || user.assigned_at) && (
                            <Badge variant="outline" className="text-[10px] ml-1 border-green-200 bg-green-50 text-green-600">Mới</Badge>
                          )}
                        </div>
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
                            Sửa quyền
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleEditUserInfo(user)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Sửa thông tin
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
                      {process.env.NEXT_PUBLIC_SUI_CONTRACT_OBJECT_ID ||
                        process.env.NEXT_PUBLIC_PHARMA_NFT_ADDRESS ||
                        "Chưa cấu hình"}
                    </code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Network:</span>
                    <Badge variant="outline">{process.env.NEXT_PUBLIC_SUI_RPC_URL?.includes('testnet') ? 'Testnet' : process.env.SUI_NETWORK || 'Sui Network'}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">IPFS Gateway:</span>
                    <Badge variant="outline">{process.env.PINATA_GATEWAY?.replace('https://', '') || "Chưa cấu hình"}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Admin Session:</span>
                    <Badge className="bg-green-100 text-green-800">
                      Đang hoạt động
                    </Badge>
                  </div>
                </div>

                {/* Backup & Restore Actions */}
                <div className="border-t pt-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Sao lưu & Phục hồi</p>

                  {/* Backup */}
                  <Button
                    variant="outline"
                    className="w-full bg-transparent justify-start"
                    size="sm"
                    onClick={async () => {
                      toast.loading("Đang tạo backup...", { id: "backup" });
                      try {
                        const res = await fetch("/api/admin/backup", {
                          credentials: "include",
                        });
                        if (!res.ok) throw new Error("Backup failed");
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `pharmadna-backup-${new Date().toISOString().split("T")[0]}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success("Backup thành công!", { id: "backup" });
                      } catch (err) {
                        console.error("Backup error:", err);
                        toast.error("Backup thất bại", { id: "backup" });
                      }
                    }}
                  >
                    <Settings className="w-4 h-4 mr-2 text-blue-600" />
                    Backup dữ liệu
                  </Button>

                  {/* Restore */}
                  <RestoreButton />

                  {/* Export */}
                  <Button
                    variant="outline"
                    className="w-full bg-transparent justify-start"
                    size="sm"
                    onClick={async () => {
                      const format = confirm("Xuất CSV? (OK = CSV, Cancel = JSON)")
                        ? "csv" : "json";
                      toast.loading("Đang xuất dữ liệu...", { id: "export" });
                      try {
                        const res = await fetch(`/api/admin/export?format=${format}`, {
                          credentials: "include",
                        });
                        if (!res.ok) throw new Error("Export failed");
                        const blob = await res.blob();
                        const a = document.createElement("a");
                        a.href = URL.createObjectURL(blob);
                        a.download = `pharmadna-export-${new Date().toISOString().split("T")[0]}.${format}`;
                        a.click();
                        URL.revokeObjectURL(a.href);
                        toast.success("Xuất dữ liệu thành công!", { id: "export" });
                      } catch (err) {
                        console.error("Export error:", err);
                        toast.error("Xuất dữ liệu thất bại", { id: "export" });
                      }
                    }}
                  >
                    <TrendingUp className="w-4 h-4 mr-2 text-orange-600" />
                    Xuất báo cáo
                  </Button>

                  {/* View Contract */}
                  <Button
                    variant="outline"
                    className="w-full bg-transparent justify-start"
                    size="sm"
                    onClick={() => {
                      try {
                        const contractAddress =
                          process.env.NEXT_PUBLIC_SUI_PACKAGE_ID ||
                          process.env.NEXT_PUBLIC_SUI_CONTRACT_OBJECT_ID ||
                          getPackageIdSafe() || "0x";
                        window.open(getSuiExplorerAddressUrl(contractAddress), "_blank");
                      } catch (error) {
                        console.error('Error opening explorer:', error);
                      }
                    }}
                  >
                    <Globe className="w-4 h-4 mr-2 text-purple-600" />
                    Xem Contract trên Explorer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AI Agent Tab */}
        <TabsContent value="ai-agent" className="space-y-6">
          {/* AI Agent System Health */}
          <div className="grid md:grid-cols-2 gap-6">
            <AIAgentDashboard />
            <AIAgentAnalytics />
          </div>

          {/* AI Agent Chat + On-chain Proposals */}
          <div className="grid lg:grid-cols-2 gap-6">
            <AIAgentPanel role="admin" context={{ userList, stats }} />
            <OnChainProposalsPanel />
          </div>
        </TabsContent>

        {/* Registrations Tab */}
        <TabsContent value="registrations" className="space-y-6">
          <RegistrationsTab />
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
          {isDashboardLoading ? (
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
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
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
                        Công ty
                      </th>
                      <th className="text-left p-4 font-medium text-gray-900">
                        Vai trò
                      </th>
                      <th className="text-left p-4 font-medium text-gray-900">
                        Giấy phép
                      </th>
                      <th className="text-left p-4 font-medium text-gray-900">
                        Liên hệ
                      </th>
                      <th className="text-left p-4 font-medium text-gray-900">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Ngày cấp quyền
                        </span>
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
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono break-all">
                            {user.address}
                          </code>
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-medium text-gray-900">{user.company_name || "—"}</div>
                          {user.tax_id && <div className="text-xs text-gray-400">MST: {user.tax_id}</div>}
                        </td>
                        <td className="p-4">
                          <Badge className={getRoleBadgeColor(user.role)}>
                            {user.role}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {user.license_number || "—"}
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          <div>{user.contact_email || "—"}</div>
                          <div className="text-xs text-gray-400">{user.contact_phone || ""}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            <span className={`flex items-center gap-1 text-sm font-medium ${isRecentDate(user.assignedAt || user.assigned_at) ? "text-green-600" : "text-gray-600"}`}>
                              <Clock className="w-3 h-3 flex-shrink-0" />
                              {formatDate(user.assignedAt || user.assigned_at)}
                            </span>
                            {isRecentDate(user.assignedAt || user.assigned_at) && (
                              <Badge variant="outline" className="text-[10px] border-green-200 bg-green-50 text-green-600 w-fit">
                                Mới cấp
                              </Badge>
                            )}
                          </div>
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
                              Sửa quyền
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditUserInfo(user)}
                              className="bg-transparent text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Sửa thông tin
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

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {userList.map((user, index) => (
                  <div key={user.address} className="border rounded-xl p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-medium">#{index + 1}</span>
                        <Badge className={getRoleBadgeColor(user.role)}>
                          {user.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500">{user.assignedAt || user.assigned_at}</p>
                    </div>
                    <div className="text-xs font-mono bg-gray-100 px-2.5 py-2 rounded-lg break-all mb-2 leading-relaxed">
                      {user.address}
                    </div>
                    {user.company_name && (
                      <div className="mb-1">
                        <span className="text-xs font-medium text-gray-700">{user.company_name}</span>
                        {user.tax_id && <span className="text-xs text-gray-400 ml-2">| MST: {user.tax_id}</span>}
                      </div>
                    )}
                    {user.license_number && (
                      <p className="text-xs text-gray-500 mb-1">GP: {user.license_number}</p>
                    )}
                    {(user.contact_email || user.contact_phone) && (
                      <p className="text-xs text-gray-400 mb-3">
                        {user.contact_email}{user.contact_email && user.contact_phone ? " | " : ""}{user.contact_phone}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 min-h-[40px] bg-transparent text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => handleEditRole(user.address, user.role as UserRole)}
                      >
                        <Edit className="w-4 h-4 mr-1.5" />
                        Sửa quyền
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 min-h-[40px] bg-transparent text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => handleEditUserInfo(user)}
                      >
                        <Eye className="w-4 h-4 mr-1.5" />
                        Sửa thông tin
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 min-h-[40px] text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleRemoveRole(user.address)}
                      >
                        <Trash2 className="w-4 h-4 mr-1.5" />
                        Xóa
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 px-2">
                  <p className="text-sm text-gray-500">
                    Hiển thị {(usersPage - 1) * 4 + 1}–{Math.min(usersPage * 4, totalUsers)} / {totalUsers} người dùng
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                      disabled={usersPage === 1 || isDashboardLoading}
                    >
                      ←
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={page === usersPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => setUsersPage(page)}
                        disabled={isDashboardLoading}
                      >
                        {page}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUsersPage((p) => Math.min(totalPages, p + 1))}
                      disabled={usersPage === totalPages || isDashboardLoading}
                    >
                      →
                    </Button>
                  </div>
                </div>
              )}
            </>
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

      {/* Performance Monitor (Dev Only) */}

      {/* Edit User Info Modal */}
      {editingInfoUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold">Sửa thông tin người dùng</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingInfoUser(null)}
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <code className="font-mono text-xs">{editingInfoUser.address}</code>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="info_company_name">Tên công ty</Label>
                  <Input
                    id="info_company_name"
                    value={infoForm.company_name}
                    onChange={(e) => setInfoForm((f) => ({ ...f, company_name: e.target.value }))}
                    placeholder="Nhập tên công ty"
                  />
                </div>
                <div>
                  <Label htmlFor="info_license_number">Số giấy phép</Label>
                  <Input
                    id="info_license_number"
                    value={infoForm.license_number}
                    onChange={(e) => setInfoForm((f) => ({ ...f, license_number: e.target.value }))}
                    placeholder="Số giấy phép"
                  />
                </div>
                <div>
                  <Label htmlFor="info_tax_id">Mã số thuế</Label>
                  <Input
                    id="info_tax_id"
                    value={infoForm.tax_id}
                    onChange={(e) => setInfoForm((f) => ({ ...f, tax_id: e.target.value }))}
                    placeholder="Mã số thuế"
                  />
                </div>
                <div>
                  <Label htmlFor="info_contact_email">Email liên hệ</Label>
                  <Input
                    id="info_contact_email"
                    type="email"
                    value={infoForm.contact_email}
                    onChange={(e) => setInfoForm((f) => ({ ...f, contact_email: e.target.value }))}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="info_contact_phone">Điện thoại</Label>
                  <Input
                    id="info_contact_phone"
                    value={infoForm.contact_phone}
                    onChange={(e) => setInfoForm((f) => ({ ...f, contact_phone: e.target.value }))}
                    placeholder="0xxx xxx xxx"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="info_company_address">Địa chỉ công ty</Label>
                  <Input
                    id="info_company_address"
                    value={infoForm.company_address}
                    onChange={(e) => setInfoForm((f) => ({ ...f, company_address: e.target.value }))}
                    placeholder="Địa chỉ công ty"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="info_notes">Ghi chú</Label>
                  <Textarea
                    id="info_notes"
                    value={infoForm.notes}
                    onChange={(e) => setInfoForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Ghi chú (nếu có)"
                    rows={2}
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingInfoUser(null)}
              >
                Hủy
              </Button>
              <Button
                onClick={handleSaveUserInfo}
                disabled={updateUserInfoMutation.isPending}
              >
                {updateUserInfoMutation.isPending ? "Đang lưu..." : "Lưu"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-8">
          <PerformanceMonitor />
        </div>
      )}
    </div>
  );
}

// ============ RegistrationsTab ============

function RegistrationsTab() {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [selectedReg, setSelectedReg] = useState<Registration | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

  const { data, isLoading, refetch } = useRegistrations({
    status: statusFilter === "all" ? undefined : (statusFilter as any),
    page: 1,
    limit: 50,
  });

  const reviewMutation = useReviewRegistration();
  const registrations = data?.data ?? [];

  const handleApprove = async (reg: Registration) => {
    try {
      await reviewMutation.mutateAsync({ id: reg.id, status: "approved" });
      toast.success("Đã duyệt đơn đăng ký!");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Duyệt thất bại");
    }
  };

  const handleReject = async () => {
    if (!selectedReg) return;
    try {
      await reviewMutation.mutateAsync({ id: selectedReg.id, status: "rejected", rejectionReason: rejectReason });
      toast.success("Đã từ chối đơn");
      setShowRejectModal(false);
      setSelectedReg(null);
      setRejectReason("");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Từ chối thất bại");
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "MANUFACTURER": return "bg-blue-100 text-blue-700";
      case "DISTRIBUTOR": return "bg-green-100 text-green-700";
      case "PHARMACY": return "bg-purple-100 text-purple-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusBadgeColor = (status: string) => ({
    pending: "bg-yellow-100 text-yellow-700 border-yellow-300",
    approved: "bg-green-100 text-green-700 border-green-300",
    rejected: "bg-red-100 text-red-700 border-red-300",
  })[status] ?? "bg-gray-100 text-gray-700";

  const getCompanyName = (reg: Registration) =>
    reg.company_name || reg.distributor_name || reg.pharmacy_name || "—";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Đơn đăng ký vai trò
                {data?.total !== undefined && data.total > 0 && (
                  <Badge variant="outline" className="ml-1 bg-yellow-50 text-yellow-700 border-yellow-300">
                    {data.total} đơn
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {statusFilter === "pending" && data?.total
                  ? `Có ${data.total} đơn đang chờ bạn duyệt`
                  : statusFilter === "pending" ? "Chưa có đơn nào đang chờ duyệt"
                  : `Đã tải ${data?.total || 0} đơn`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Lọc" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Đang chờ</SelectItem>
                  <SelectItem value="approved">Đã duyệt</SelectItem>
                  <SelectItem value="rejected">Đã từ chối</SelectItem>
                  <SelectItem value="all">Tất cả</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => refetch()} aria-label="Làm mới danh sách"><RefreshCw className="w-4 h-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => (<Skeleton key={i} className="h-16 w-full" />))}</div>
          ) : registrations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Chưa có đơn đăng ký nào</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-gray-600">ID</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Địa chỉ ví</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Vai trò</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Công ty</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Giấy phép</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Ngày gửi</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Trạng thái</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((reg) => (
                    <tr key={reg.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2 text-gray-500">#{reg.id}</td>
                      <td className="py-2 px-2 font-mono text-xs">{reg.wallet_address.slice(0, 10)}...{reg.wallet_address.slice(-6)}</td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(reg.requested_role)}`}>{reg.requested_role}</span>
                      </td>
                      <td className="py-2 px-2 max-w-[150px] truncate">{getCompanyName(reg)}</td>
                      <td className="py-2 px-2 text-xs text-gray-600 max-w-[120px] truncate">{reg.license_number || "—"}</td>
                      <td className="py-2 px-2 text-xs text-gray-500">{reg.created_at ? new Date(reg.created_at).toLocaleDateString("vi-VN") : "—"}</td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-0.5 rounded border text-xs font-medium ${getStatusBadgeColor(reg.status)}`}>
                          {reg.status === "pending" ? "Chờ duyệt" : reg.status === "approved" ? "Đã duyệt" : "Từ chối"}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" title="Xem chi tiết" onClick={() => setSelectedReg(reg)}><Eye className="w-4 h-4" /></Button>
                          {reg.status === "pending" && (
                            <>
                              <Button variant="ghost" size="sm" title="Duyệt" className="text-green-600 hover:text-green-700"
                                onClick={() => handleApprove(reg)} disabled={reviewMutation.isPending}><Check className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="sm" title="Từ chối" className="text-red-600 hover:text-red-700"
                                onClick={() => { setSelectedReg(reg); setShowRejectModal(true); }} disabled={reviewMutation.isPending}><X className="w-4 h-4" /></Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedReg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold">Chi tiết đơn đăng ký</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedReg(null)} aria-label="Đóng">✕</Button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-gray-500">ID</p><p className="font-medium">#{selectedReg.id}</p></div>
                <div>
                  <p className="text-sm text-gray-500">Vai trò</p>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(selectedReg.requested_role)}`}>{selectedReg.requested_role}</span>
                </div>
                <div className="col-span-2"><p className="text-sm text-gray-500">Địa chỉ ví</p><p className="font-mono text-sm break-all">{selectedReg.wallet_address}</p></div>
                <div>
                  <p className="text-sm text-gray-500">
                    {selectedReg.requested_role === "MANUFACTURER" ? "Tên công ty" : selectedReg.requested_role === "DISTRIBUTOR" ? "Tên công ty phân phối" : "Tên nhà thuốc"}
                  </p>
                  <p className="font-medium">{getCompanyName(selectedReg)}</p>
                </div>
                <div><p className="text-sm text-gray-500">Số giấy phép</p><p className="font-medium">{selectedReg.license_number || "—"}</p></div>
                <div><p className="text-sm text-gray-500">Mã số thuế</p><p className="font-medium">{selectedReg.tax_id || "—"}</p></div>
                <div><p className="text-sm text-gray-500">Địa chỉ</p><p className="font-medium">{selectedReg.distributor_address || selectedReg.pharmacy_address || "—"}</p></div>
                <div><p className="text-sm text-gray-500">Email</p><p className="font-medium">{selectedReg.contact_email || "—"}</p></div>
                <div><p className="text-sm text-gray-500">Điện thoại</p><p className="font-medium">{selectedReg.contact_phone || "—"}</p></div>
                <div className="col-span-2"><p className="text-sm text-gray-500">Ngày gửi</p><p className="font-medium">{selectedReg.created_at ? new Date(selectedReg.created_at).toLocaleString("vi-VN") : "—"}</p></div>
                {selectedReg.notes && <div className="col-span-2"><p className="text-sm text-gray-500">Ghi chú</p><p className="font-medium">{selectedReg.notes}</p></div>}
                {selectedReg.license_ipfs_hash && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500 mb-1">Giấy phép (IPFS)</p>
                    <a href={`https://gateway.pinata.cloud/ipfs/${selectedReg.license_ipfs_hash}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm">
                      Xem giấy phép <ExternalLink className="w-3 h-3" />
                    </a>
                    <br />
                    <span className="text-xs text-gray-400 font-mono">{selectedReg.license_ipfs_hash}</span>
                  </div>
                )}
                {selectedReg.status === "rejected" && selectedReg.rejection_reason && (
                  <div className="col-span-2"><p className="text-sm text-gray-500">Lý do từ chối</p><p className="font-medium text-red-600">{selectedReg.rejection_reason}</p></div>
                )}
                {selectedReg.status === "approved" && selectedReg.blockchain_tx && (
                  <div className="col-span-2"><p className="text-sm text-gray-500">Transaction</p><p className="font-mono text-xs text-gray-600 break-all">{selectedReg.blockchain_tx}</p></div>
                )}
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedReg(null)}>Đóng</Button>
              {selectedReg.status === "pending" && (
                <>
                  <Button variant="destructive" onClick={() => { setSelectedReg(null); setShowRejectModal(true); }}>Từ chối</Button>
                  <Button onClick={() => { handleApprove(selectedReg); setSelectedReg(null); }}><Check className="w-4 h-4 mr-1" /> Duyệt</Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedReg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold">Từ chối đơn đăng ký</h3>
              <p className="text-sm text-gray-500 mt-1">Địa chỉ: <span className="font-mono text-xs">{selectedReg.wallet_address}</span></p>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rejectReason">Lý do từ chối (tùy chọn)</Label>
                <Textarea id="rejectReason" placeholder="Nhập lý do từ chối..." value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)} rows={3} />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowRejectModal(false); setSelectedReg(null); }}>Hủy</Button>
              <Button variant="destructive" onClick={handleReject} disabled={reviewMutation.isPending}>
                {reviewMutation.isPending ? "Đang xử lý..." : "Xác nhận từ chối"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface AdminPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default function AdminPage({ searchParams }: AdminPageProps) {

  return (
    <ErrorBoundary>
      <AdminGuard>
        <AdminContent />
      </AdminGuard>
    </ErrorBoundary>
  );
}
