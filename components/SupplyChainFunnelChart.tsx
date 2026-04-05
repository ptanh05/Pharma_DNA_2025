"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, FunnelChart as RechartsFunnelChart, Funnel, LabelList, Tooltip, Cell } from "recharts";
import { Filter } from "lucide-react";

interface FunnelChartProps {
  data: {
    created?: number;
    minted?: number;
    at_distributor?: number;
    at_pharmacy?: number;
    dispensed?: number;
  };
  isLoading?: boolean;
}

const FUNNEL_STAGES = [
  { key: "minted", label: "Đã mint", color: "#3b82f6" },
  { key: "at_distributor", label: "Vận chuyển", color: "#f59e0b" },
  { key: "at_pharmacy", label: "Tại nhà thuốc", color: "#10b981" },
  { key: "dispensed", label: "Đã bán", color: "#8b5cf6" },
];

export function SupplyChainFunnelChart({ data, isLoading }: FunnelChartProps) {
  const chartData = FUNNEL_STAGES.map((stage) => ({
    name: stage.label,
    value: Number(data?.[stage.key as keyof typeof data] ?? 0),
    fill: stage.color,
  }));

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center">
          <Filter className="w-4 h-4 mr-2 text-blue-600" />
          Hành trình NFT trong chuỗi cung ứng
        </CardTitle>
        <CardDescription>
          Tỷ lệ chuyển đổi NFT qua các giai đoạn
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[260px] flex items-center justify-center">
            <div className="animate-pulse space-y-3 w-full">
              {[80, 65, 50, 35, 20].map((w, i) => (
                <div key={i} className="h-8 bg-gray-200 rounded mx-auto" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
        ) : total === 0 ? (
          <div className="h-[260px] flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Filter className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Chưa có dữ liệu NFT</p>
            </div>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <RechartsFunnelChart>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value} NFT`,
                    name,
                  ]}
                />
                <Funnel
                  dataKey="value"
                  data={chartData}
                  isAnimationActive
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                  <LabelList
                    position="right"
                    fill="#374151"
                    stroke="none"
                    fontSize={12}
                    dataKey="name"
                  />
                  <LabelList
                    position="center"
                    fill="#ffffff"
                    stroke="none"
                    fontSize={11}
                    fontWeight="bold"
                    dataKey="value"
                  />
                </Funnel>
              </RechartsFunnelChart>
            </ResponsiveContainer>

            {/* Conversion rates */}
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              {chartData.slice(1).map((item, idx) => {
                const prev = chartData[idx].value;
                const curr = item.value;
                const rate = prev > 0 ? ((curr / prev) * 100).toFixed(0) : "0";
                return (
                  <div key={item.name} className="text-center">
                    <div className="text-xs text-gray-500">{chartData[idx].name}</div>
                    <div className={`text-sm font-semibold ${rate >= 80 ? "text-green-600" : rate >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                      {rate}%
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default SupplyChainFunnelChart;
