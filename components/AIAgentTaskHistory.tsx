"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Clock, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TaskHistoryItem {
  task: string;
  result?: any;
  timestamp: string;
  success?: boolean;
  fromCache?: boolean;
}

interface HistoryStats {
  total: number;
  success: number;
  failed: number;
}

export default function AIAgentTaskHistory({ sessionId }: { sessionId: string }) {
  const [history, setHistory] = useState<TaskHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [stats, setStats] = useState<HistoryStats>({ total: 0, success: 0, failed: 0 });
  const [filter, setFilter] = useState<"all" | "success" | "failed">("all");
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/ai-agent/history?sessionId=${sessionId}`);
      const data = await res.json();
      if (data.success) {
        // Parse history items from the memory
        const items: TaskHistoryItem[] = (data.history || []).map((item: any, idx: number) => {
          let parsedResult = item.result;
          let parsedSuccess = true;

          try {
            if (typeof item.result === "string") {
              parsedResult = JSON.parse(item.result);
            }
            // Check if result indicates success or failure
            if (parsedResult?.success === false || parsedResult?.error) {
              parsedSuccess = false;
            }
          } catch {
            // Keep as string if not JSON
          }

          return {
            task: item.task || "Task",
            result: parsedResult,
            timestamp: item.timestamp || new Date().toISOString(),
            success: parsedSuccess,
          };
        });

        // Also fetch from audit logs for more complete history
        try {
          const auditRes = await fetch(`/api/ai-agent/audit-logs?sessionId=${sessionId}&limit=50`);
          const auditData = await auditRes.json();
          if (auditData.success && auditData.logs) {
            const auditItems: TaskHistoryItem[] = auditData.logs.map((log: any) => ({
              task: log.params?.task || log.action || "Action",
              result: log.error ? { success: false, error: log.error } : { success: true, message: "Completed" },
              timestamp: log.timestamp,
              success: log.result === "success",
            }));
            // Merge, avoiding duplicates by timestamp
            const merged = [...items];
            for (const auditItem of auditItems) {
              if (!merged.some(m => m.timestamp === auditItem.timestamp)) {
                merged.push(auditItem);
              }
            }
            merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setHistory(merged);
          } else {
            setHistory(items);
          }
        } catch {
          setHistory(items);
        }

        // Calculate stats
        const successCount = items.filter(i => i.success).length;
        const failedCount = items.filter(i => !i.success).length;
        setStats({
          total: items.length,
          success: successCount,
          failed: failedCount,
        });
        setLastFetched(new Date());
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // Refresh every 30 seconds
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const toggleExpand = (idx: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
    }
    setExpandedItems(newExpanded);
  };

  const filteredHistory = history.filter(item => {
    if (filter === "success") return item.success;
    if (filter === "failed") return !item.success;
    return true;
  });

  const formatResult = (result: any): string => {
    if (!result) return "Không có kết quả";
    if (typeof result === "string") return result;
    if (result.success === false) return `Lỗi: ${result.error || "Unknown error"}`;
    if (result.message) return result.message;
    return JSON.stringify(result, null, 2);
  };

  const getResultPreview = (result: any): string => {
    if (!result) return "Không có kết quả";
    if (typeof result === "string") return result.substring(0, 150);
    if (result.success === false) return `Lỗi: ${(result.error || "Unknown").substring(0, 100)}`;
    if (result.transactionHash || result.transactionDigest) {
      return `Transaction: ${(result.transactionHash || result.transactionDigest)?.substring(0, 20)}...`;
    }
    if (result.proposalId) return `Proposal #${result.proposalId} - ${result.message || "Created"}`;
    if (result.report) return `Report generated`;
    if (result.analysis) return `Analysis complete`;
    return JSON.stringify(result).substring(0, 150);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center text-lg">
              <History className="w-5 h-5 mr-2" />
              Task History
            </CardTitle>
            <CardDescription>Lịch sử các tasks đã thực hiện trong phiên này</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchHistory} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Stats Summary */}
        <div className="flex gap-4 mt-2">
          <Badge variant="outline" className="text-xs">
            Tổng: {stats.total}
          </Badge>
          <Badge variant="outline" className="text-xs text-green-600 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            {stats.success} thành công
          </Badge>
          <Badge variant="outline" className="text-xs text-red-600 border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            {stats.failed} thất bại
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="mb-4">
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs px-3">Tất cả ({stats.total})</TabsTrigger>
            <TabsTrigger value="success" className="text-xs px-3">Thành công ({stats.success})</TabsTrigger>
            <TabsTrigger value="failed" className="text-xs px-3">Thất bại ({stats.failed})</TabsTrigger>
          </TabsList>
        </Tabs>

        <ScrollArea className="h-[350px]">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Chưa có lịch sử</p>
              <p className="text-xs mt-1">Tasks sẽ xuất hiện ở đây sau khi thực hiện</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((item, idx) => (
                <div key={idx} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium line-clamp-2">{item.task}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-gray-500">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {new Date(item.timestamp).toLocaleString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        {item.fromCache && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            Cached
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Badge
                        variant={item.success !== false ? "default" : "destructive"}
                        className={item.success !== false ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                      >
                        {item.success !== false ? (
                          <CheckCircle className="w-3 h-3 mr-1" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-1" />
                        )}
                        {item.success !== false ? "OK" : "Lỗi"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(idx)}
                        className="h-6 w-6 p-0"
                      >
                        {expandedItems.has(idx) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Result Preview */}
                  <div
                    className={`mt-2 p-2 rounded text-xs cursor-pointer transition-colors ${
                      item.success !== false
                        ? "bg-green-50 border border-green-100 hover:bg-green-100"
                        : "bg-red-50 border border-red-100 hover:bg-red-100"
                    }`}
                    onClick={() => toggleExpand(idx)}
                  >
                    <div className="flex items-center justify-between">
                      <p className="line-clamp-1 flex-1">
                        {getResultPreview(item.result)}
                      </p>
                      <ExternalLink className="w-3 h-3 ml-2 flex-shrink-0 opacity-50" />
                    </div>
                  </div>

                  {/* Expanded Result */}
                  {expandedItems.has(idx) && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
                      <p className="text-xs font-medium mb-2 text-gray-700">Chi tiết kết quả:</p>
                      <pre className="whitespace-pre-wrap text-xs text-gray-700 max-h-[300px] overflow-auto">
                        {formatResult(item.result)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {lastFetched && (
          <p className="text-xs text-gray-400 mt-2 text-right">
            Cập nhật: {lastFetched.toLocaleTimeString("vi-VN")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
