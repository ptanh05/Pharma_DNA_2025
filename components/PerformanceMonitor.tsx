"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trash2 } from "lucide-react";

interface PerformanceStats {
  count: number;
  avg: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
}

export default function PerformanceMonitor() {
  const [stats, setStats] = useState<Record<string, PerformanceStats>>({});
  const [loading, setLoading] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/performance/metrics");
      const data = await response.json();
      setStats(data.stats || {});
    } catch (error) {
      console.error("Failed to fetch metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const clearMetrics = async () => {
    try {
      await fetch("/api/performance/metrics", { method: "DELETE" });
      setStats({});
    } catch (error) {
      console.error("Failed to clear metrics:", error);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Performance Metrics</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchMetrics}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={clearMetrics}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {Object.keys(stats).length === 0 ? (
          <p className="text-sm text-gray-500">No metrics available</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(stats).map(([operation, stat]) => (
              <div key={operation} className="border rounded p-3">
                <h4 className="font-semibold text-sm mb-2">{operation}</h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Count:</span> {stat.count}
                  </div>
                  <div>
                    <span className="text-gray-500">Avg:</span> {stat.avg}ms
                  </div>
                  <div>
                    <span className="text-gray-500">Min:</span> {stat.min}ms
                  </div>
                  <div>
                    <span className="text-gray-500">Max:</span> {stat.max}ms
                  </div>
                  <div>
                    <span className="text-gray-500">P95:</span> {stat.p95}ms
                  </div>
                  <div>
                    <span className="text-gray-500">P99:</span> {stat.p99}ms
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

