"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AIAgentDashboard() {
  const [health, setHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/ai-agent/health");
      const data = await res.json();
      
      if (data.success) {
        setHealth(data.health);
        setLastChecked(new Date());
      }
    } catch (error) {
      console.error("Health check error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    // Auto refresh every 5 minutes
    const interval = setInterval(checkHealth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-100 text-green-800";
      case "warning":
        return "bg-yellow-100 text-yellow-800";
      case "critical":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              System Health Monitor
            </CardTitle>
            <CardDescription>
              AI Agent tự động monitor và phát hiện vấn đề
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={checkHealth}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {health ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Trạng thái:</span>
              <Badge className={getStatusColor(health.status || "unknown")}>
                {health.status === "healthy" ? (
                  <CheckCircle className="w-3 h-3 mr-1" />
                ) : (
                  <AlertTriangle className="w-3 h-3 mr-1" />
                )}
                {health.status || "Unknown"}
              </Badge>
            </div>

            {health.issues && health.issues.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Vấn đề phát hiện:</h4>
                <div className="space-y-2">
                  {health.issues.map((issue: any, idx: number) => (
                    <Alert
                      key={idx}
                      variant={issue.severity === "critical" ? "destructive" : "default"}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="flex items-center justify-between">
                          <span>
                            <strong>{issue.type}:</strong> {issue.message}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              issue.severity === "critical"
                                ? "border-red-500 text-red-700"
                                : "border-yellow-500 text-yellow-700"
                            }
                          >
                            {issue.severity}
                          </Badge>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            {health.issues && health.issues.length === 0 && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Hệ thống hoạt động bình thường. Không có vấn đề nào được phát hiện.
                </AlertDescription>
              </Alert>
            )}

            {lastChecked && (
              <p className="text-xs text-gray-500">
                Cập nhật lần cuối: {lastChecked.toLocaleString("vi-VN")}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            {isLoading ? "Đang kiểm tra..." : "Chưa có dữ liệu"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

