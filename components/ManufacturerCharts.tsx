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
import { RefreshCw, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NFTStats {
  total: number;
  created: number;
  minted: number;
  pending: number;
}

interface ChartDataPoint {
  date: string;
  label: string;
  nfts: number;
  milestones: number;
}

interface MilestoneStats {
  total: number;
  byType: Record<string, number>;
}

interface ManufacturerChartsProps {
  address?: string;
  className?: string;
}

export function ManufacturerCharts({ address, className = "" }: ManufacturerChartsProps) {
  const [nftStats, setNftStats] = useState<NFTStats>({ total: 0, created: 0, minted: 0, pending: 0 });
  const [nftOverTime, setNftOverTime] = useState<ChartDataPoint[]>([]);
  const [milestoneStats, setMilestoneStats] = useState<MilestoneStats>({ total: 0, byType: {} });
  const [isLoading, setIsLoading] = useState(false);

  const fetchChartData = async () => {
    setIsLoading(true);
    try {
      // Fetch NFT stats from manufacturer NFTs API
      if (address) {
        const nftRes = await fetch(`/api/manufacturer/nfts?address=${address}`);
        const nftData = await nftRes.json();
        if (nftData.success && nftData.data?.nfts) {
          const nfts = nftData.data.nfts;
          const created = nfts.filter((n: any) => n.status === "created").length;
          const minted = nfts.filter((n: any) => n.status === "minted").length;
          const pending = nfts.filter((n: any) => n.status === "pending").length;
          setNftStats({ total: nfts.length, created, minted, pending });

          // Group by date
          const byDate: Record<string, number> = {};
          nfts.forEach((n: any) => {
            if (n.created_at) {
              const date = new Date(n.created_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
              byDate[date] = (byDate[date] || 0) + 1;
            }
          });
          const timeData = Object.entries(byDate).map(([date, count]) => ({
            date,
            label: date,
            nfts: count,
            milestones: 0,
          })).sort((a, b) => {
            const [d1, m1, y1] = a.date.split("/");
            const [d2, m2, y2] = b.date.split("/");
            return new Date(`${y1}-${m1}-${d1}`).getTime() - new Date(`${y2}-${m2}-${d2}`).getTime();
          });
          setNftOverTime(timeData.slice(-14)); // last 14 days
        }
      }

      // Fetch milestones for milestone chart
      const msRes = await fetch("/api/dashboard/activity?limit=100");
      const msData = await msRes.json();
      if (msData.success && msData.data?.activity) {
        const activities = msData.data.activity;
        const byType: Record<string, number> = {};
        activities.forEach((a: any) => {
          const type = a.type || "Khác";
          byType[type] = (byType[type] || 0) + 1;
        });
        setMilestoneStats({ total: activities.length, byType });
      }
    } catch (error) {
      console.error("Failed to fetch chart data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData();
  }, [address]);

  // Prepare milestone chart data
  const milestoneChartData = Object.entries(milestoneStats.byType).map(([type, count]) => ({
    name: type.length > 15 ? type.slice(0, 15) + "..." : type,
    fullName: type,
    count,
  }));

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Stats summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Tổng NFT</p>
              <p className="text-2xl font-bold text-gray-900">{nftStats.total}</p>
            </div>
            <div className="p-2 bg-blue-50 rounded-full">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Đã tạo</p>
              <p className="text-2xl font-bold text-green-600">{nftStats.created}</p>
            </div>
            <div className="p-2 bg-green-50 rounded-full">
              <Package className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Đã mint</p>
              <p className="text-2xl font-bold text-purple-600">{nftStats.minted}</p>
            </div>
            <div className="p-2 bg-purple-50 rounded-full">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Chờ duyệt</p>
              <p className="text-2xl font-bold text-yellow-600">{nftStats.pending}</p>
            </div>
            <div className="p-2 bg-yellow-50 rounded-full">
              <Package className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* NFT creation over time - Line Chart */}
        <ChartCard
          title="NFT tạo theo thời gian"
          description="Số lượng NFT được tạo trong 14 ngày gần nhất"
        >
          <div className="p-4">
            {isLoading ? (
              <div className="h-[250px] flex items-center justify-center">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : nftOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={nftOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="nfts"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: "#3b82f6", r: 3 }}
                    activeDot={{ r: 5 }}
                    name="NFT"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
                Chưa có dữ liệu NFT
              </div>
            )}
          </div>
        </ChartCard>

        {/* Milestone completion - Bar Chart */}
        <ChartCard
          title="Mốc vận chuyển theo loại"
          description="Số lượng hoạt động theo từng loại mốc"
        >
          <div className="p-4">
            {isLoading ? (
              <div className="h-[250px] flex items-center justify-center">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : milestoneChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={milestoneChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    formatter={(value: number, name: string, props: any) => [value, props.payload.fullName]}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} name="Số lượng" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
                Chưa có dữ liệu mốc vận chuyển
              </div>
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

export default ManufacturerCharts;
