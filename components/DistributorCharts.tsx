"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartCard } from "@/components/ChartCard";
import { RefreshCw, Truck, Package } from "lucide-react";

interface DistributorChartsProps {
  address?: string;
  nftList?: any[];
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  in_transit: "#f59e0b",
  received: "#10b981",
  delivered: "#3b82f6",
  pending: "#e5e7eb",
  default: "#6b7280",
};

export function DistributorCharts({ address, nftList = [], className = "" }: DistributorChartsProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Compute stats from nftList
  const stats = {
    total: nftList.length,
    inTransit: nftList.filter((n) => n.status === "in_transit").length,
    received: nftList.filter((n) => n.status === "received").length,
    delivered: nftList.filter((n) => n.status === "delivered").length,
  };

  // Status distribution for pie chart
  const statusDistribution = [
    { name: "Đang vận chuyển", value: stats.inTransit, color: STATUS_COLORS.in_transit },
    { name: "Đã nhận", value: stats.received, color: STATUS_COLORS.received },
    { name: "Đã giao", value: stats.delivered, color: STATUS_COLORS.delivered },
  ].filter((d) => d.value > 0);

  // Transfer volume over time (mock from nftList dates)
  const [transferVolume, setTransferVolume] = useState<any[]>([]);

  useEffect(() => {
    if (nftList.length > 0) {
      const byDate: Record<string, number> = {};
      nftList.forEach((n) => {
        if (n.updated_at || n.created_at) {
          const date = new Date(n.updated_at || n.created_at).toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
          });
          byDate[date] = (byDate[date] || 0) + 1;
        }
      });
      const data = Object.entries(byDate)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => {
          const [d1, m1, y1] = a.date.split("/");
          const [d2, m2, y2] = b.date.split("/");
          return new Date(`${y1}-${m1}-${d1}`).getTime() - new Date(`${y2}-${m2}-${d2}`).getTime();
        })
        .slice(-14);
      setTransferVolume(data);
    }
  }, [nftList]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Stats summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Tổng lô</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="p-2 bg-blue-50 rounded-full">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Đang vận chuyển</p>
              <p className="text-2xl font-bold text-amber-600">{stats.inTransit}</p>
            </div>
            <div className="p-2 bg-amber-50 rounded-full">
              <Truck className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Đã nhận</p>
              <p className="text-2xl font-bold text-green-600">{stats.received}</p>
            </div>
            <div className="p-2 bg-green-50 rounded-full">
              <Package className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Đã giao</p>
              <p className="text-2xl font-bold text-blue-600">{stats.delivered}</p>
            </div>
            <div className="p-2 bg-blue-50 rounded-full">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Transfer Volume - Line Chart */}
        <ChartCard
          title="Lưu lượng chuyển giao"
          description="Số lượng lô thuốc được cập nhật theo thời gian"
        >
          <div className="p-4">
            {isLoading ? (
              <div className="h-[250px] flex items-center justify-center">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : transferVolume.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={transferVolume}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12 }} labelStyle={{ fontWeight: 600 }} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ fill: "#8b5cf6", r: 3 }}
                    activeDot={{ r: 5 }}
                    name="Lô thuốc"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
                Chưa có dữ liệu chuyển giao
              </div>
            )}
          </div>
        </ChartCard>

        {/* Delivery Status - Pie Chart */}
        <ChartCard
          title="Tỷ lệ trạng thái giao hàng"
          description="Phân bố trạng thái các lô thuốc"
        >
          <div className="p-4">
            {statusDistribution.length > 0 ? (
              <div className="flex items-center">
                <ResponsiveContainer width="60%" height={250}>
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {statusDistribution.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: entry.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{entry.name}</p>
                      </div>
                      <p className="text-sm font-bold text-gray-900">{entry.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
                Chưa có dữ liệu trạng thái
              </div>
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

export default DistributorCharts;
