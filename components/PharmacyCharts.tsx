"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartCard } from "@/components/ChartCard";
import { RefreshCw, Warehouse, Package } from "lucide-react";

interface PharmacyChartsProps {
  inventory?: any[];
  className?: string;
}

export function PharmacyCharts({ inventory = [], className = "" }: PharmacyChartsProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Compute stats from inventory
  const stats = {
    total: inventory.length,
    available: inventory.filter((n) => n.status === "available").length,
    atPharmacy: inventory.filter((n) => n.status === "at_pharmacy" || n.status === "minted").length,
    dispensed: inventory.filter((n) => n.status === "dispensed").length,
  };

  // Inventory levels by drug name (bar chart)
  const inventoryByName: Record<string, number> = {};
  inventory.forEach((item) => {
    const name = item.name || "Không tên";
    inventoryByName[name] = (inventoryByName[name] || 0) + (item.quantity || 1);
  });
  const inventoryChartData = Object.entries(inventoryByName)
    .map(([name, count]) => ({
      name: name.length > 12 ? name.slice(0, 12) + "..." : name,
      fullName: name,
      count,
    }))
    .slice(0, 10);

  // Dispensing over time (from created_at dates)
  const [dispensingData, setDispensingData] = useState<any[]>([]);

  useEffect(() => {
    if (inventory.length > 0) {
      const byDate: Record<string, number> = {};
      inventory.forEach((item) => {
        if (item.created_at) {
          const date = new Date(item.created_at).toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
          });
          byDate[date] = (byDate[date] || 0) + (item.quantity || 1);
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
      setDispensingData(data);
    }
  }, [inventory]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Stats summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Tổng kho</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="p-2 bg-blue-50 rounded-full">
              <Warehouse className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Còn hàng</p>
              <p className="text-2xl font-bold text-green-600">{stats.available}</p>
            </div>
            <div className="p-2 bg-green-50 rounded-full">
              <Package className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Đã nhập kho</p>
              <p className="text-2xl font-bold text-purple-600">{stats.atPharmacy}</p>
            </div>
            <div className="p-2 bg-purple-50 rounded-full">
              <Warehouse className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Đã bán</p>
              <p className="text-2xl font-bold text-orange-600">{stats.dispensed}</p>
            </div>
            <div className="p-2 bg-orange-50 rounded-full">
              <Package className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Inventory Levels - Bar Chart */}
        <ChartCard
          title="Mức tồn kho theo thuốc"
          description="Số lượng từng loại thuốc trong kho"
        >
          <div className="p-4">
            {isLoading ? (
              <div className="h-[250px] flex items-center justify-center">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : inventoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={inventoryChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    formatter={(value: number, name: string, props: any) => [
                      value,
                      props.payload.fullName,
                    ]}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Số lượng" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
                Chưa có dữ liệu tồn kho
              </div>
            )}
          </div>
        </ChartCard>

        {/* Dispensing Stats - Line Chart */}
        <ChartCard
          title="Nhập kho theo thời gian"
          description="Số lượng thuốc nhập kho trong 14 ngày gần nhất"
        >
          <div className="p-4">
            {isLoading ? (
              <div className="h-[250px] flex items-center justify-center">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : dispensingData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={dispensingData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12 }} labelStyle={{ fontWeight: 600 }} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#ec4899"
                    strokeWidth={2}
                    dot={{ fill: "#ec4899", r: 3 }}
                    activeDot={{ r: 5 }}
                    name="Số lượng"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
                Chưa có dữ liệu nhập kho
              </div>
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

export default PharmacyCharts;
