"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { TrendingUp, Users, Activity, AlertCircle, RefreshCw } from "lucide-react";
import AIAgentRadarChart from "@/components/AIAgentRadarChart";

export default function AIAgentAnalytics() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [period, setPeriod] = useState("7d");

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/ai-agent/analytics?period=${period}`);
      const data = await res.json();
      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  if (!analytics) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Đang tải analytics...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              AI Agent Analytics
            </CardTitle>
            <CardDescription>
              Thống kê sử dụng và hiệu suất AI Agent
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPeriod("7d")}
              className={period === "7d" ? "bg-blue-50" : ""}
            >
              7 ngày
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPeriod("30d")}
              className={period === "30d" ? "bg-blue-50" : ""}
            >
              30 ngày
            </Button>
            <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview">
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">
                      {analytics.summary.totalRequests}
                    </div>
                    <p className="text-sm text-gray-600">Total Requests</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">
                      {analytics.summary.successRate}%
                    </div>
                    <p className="text-sm text-gray-600">Success Rate</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600">
                      {analytics.summary.avgResponseTime}s
                    </div>
                    <p className="text-sm text-gray-600">Avg Response</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-600">
                      {analytics.summary.failureCount}
                    </div>
                    <p className="text-sm text-gray-600">Failures</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Requests per day chart */}
            {analytics.requestsPerDay && analytics.requestsPerDay.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">Requests per Day</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.requestsPerDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="success" stroke="#10b981" strokeWidth={2} />
                    <Line type="monotone" dataKey="failure" stroke="#ef4444" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>

          {/* Performance Radar */}
          <TabsContent value="performance">
            <AIAgentRadarChart analytics={analytics} />
          </TabsContent>

          {/* Tools */}
          <TabsContent value="tools">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Most Used Tools</h3>
              {analytics.mostUsedTools && analytics.mostUsedTools.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.mostUsedTools}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="tool" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {analytics.mostUsedTools.map((tool: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 border rounded">
                        <code className="text-sm">{tool.tool}</code>
                        <Badge>{tool.count} uses</Badge>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-gray-500 text-center py-8">Chưa có dữ liệu</p>
              )}
            </div>
          </TabsContent>

          {/* Users */}
          <TabsContent value="users">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Top Users</h3>
              {analytics.topUsers && analytics.topUsers.length > 0 ? (
                <div className="space-y-2">
                  {analytics.topUsers.map((user: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <code className="text-sm font-mono">{user.user_id}</code>
                      </div>
                      <Badge variant="outline">{user.count} requests</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">Chưa có dữ liệu</p>
              )}
            </div>
          </TabsContent>

          {/* Errors */}
          <TabsContent value="errors">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center">
                <AlertCircle className="w-5 h-5 mr-2 text-red-600" />
                Error Types
              </h3>
              {analytics.errorTypes && analytics.errorTypes.length > 0 ? (
                <div className="space-y-2">
                  {analytics.errorTypes.map((error: any, idx: number) => (
                    <div key={idx} className="p-3 border border-red-200 rounded bg-red-50">
                      <div className="flex items-center justify-between mb-1">
                        <code className="text-sm text-red-800">{error.error}</code>
                        <Badge variant="destructive">{error.count} times</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">Không có lỗi nào</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

