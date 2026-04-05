"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadarChart as RechartsRadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";
import { Activity } from "lucide-react";

interface RadarChartProps {
  analytics: {
    summary: {
      totalRequests: number;
      successRate: string;
      avgResponseTime: string;
      failureCount: number;
    };
    mostUsedTools?: { tool: string; count: number }[];
  };
  isLoading?: boolean;
}

export function AIAgentRadarChart({ analytics, isLoading }: RadarChartProps) {
  const successRate = parseFloat(analytics.summary.successRate);
  const avgResponse = parseFloat(analytics.summary.avgResponseTime);
  const totalRequests = analytics.summary.totalRequests;

  // Normalize metrics to 0-100 scale for radar chart
  // Success rate: already 0-100
  // Avg response: invert and scale (lower is better, 0s = 100, 30s+ = 0)
  const responseScore = Math.max(0, Math.min(100, (1 - avgResponse / 30) * 100));
  // Request volume: normalize based on typical ranges (0-1000 = 0-100)
  const volumeScore = Math.min(100, (totalRequests / 1000) * 100);
  // Tool diversity: based on unique tools used (0-10 tools = 0-100)
  const toolCount = analytics.mostUsedTools?.length ?? 0;
  const diversityScore = Math.min(100, (toolCount / 10) * 100);
  // Reliability: inverse of failure rate (100 - failure%)
  const reliabilityScore = Math.max(0, Math.min(100, 100 - ((analytics.summary.failureCount / Math.max(1, totalRequests)) * 100)));

  const radarData = [
    { metric: "Success Rate", score: successRate, fullMark: 100 },
    { metric: "Response Speed", score: responseScore, fullMark: 100 },
    { metric: "Request Volume", score: volumeScore, fullMark: 100 },
    { metric: "Tool Diversity", score: diversityScore, fullMark: 100 },
    { metric: "Reliability", score: reliabilityScore, fullMark: 100 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center">
          <Activity className="w-4 h-4 mr-2 text-purple-600" />
          AI Agent Performance Radar
        </CardTitle>
        <CardDescription>
          Đánh giá tổng hợp hiệu suất AI Agent
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[280px] flex items-center justify-center">
            <div className="animate-pulse w-64 h-64 rounded-full bg-gray-200" />
          </div>
        ) : totalRequests === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Chưa có dữ liệu AI Agent</p>
            </div>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <RechartsRadarChart cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                />
                <Radar
                  name="AI Agent"
                  dataKey="score"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(0)}/100`, 'Score']}
                />
              </RechartsRadarChart>
            </ResponsiveContainer>

            {/* Legend scores */}
            <div className="grid grid-cols-5 gap-1 mt-2 text-center text-xs">
              {radarData.map((item) => (
                <div key={item.metric}>
                  <div className="text-gray-500 truncate">{item.metric.split(" ")[0]}</div>
                  <div className={`font-semibold ${item.score >= 70 ? "text-green-600" : item.score >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                    {item.score.toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default AIAgentRadarChart;
