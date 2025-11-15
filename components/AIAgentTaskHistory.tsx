"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TaskHistoryItem {
  task: string;
  result: any;
  timestamp: string;
  success?: boolean;
}

export default function AIAgentTaskHistory({ sessionId }: { sessionId: string }) {
  const [history, setHistory] = useState<TaskHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/ai-agent/history?sessionId=${sessionId}`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.history || []);
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center text-lg">
              <History className="w-5 h-5 mr-2" />
              Task History
            </CardTitle>
            <CardDescription>Lịch sử các tasks đã thực hiện</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchHistory} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Chưa có lịch sử</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item, idx) => (
                <div key={idx} className="border rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium line-clamp-2">{item.task}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {new Date(item.timestamp).toLocaleString("vi-VN")}
                      </p>
                    </div>
                    <Badge
                      variant={item.success !== false ? "default" : "destructive"}
                      className="ml-2"
                    >
                      {item.success !== false ? (
                        <CheckCircle className="w-3 h-3 mr-1" />
                      ) : (
                        <XCircle className="w-3 h-3 mr-1" />
                      )}
                      {item.success !== false ? "Success" : "Failed"}
                    </Badge>
                  </div>
                  {item.result && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                      <pre className="whitespace-pre-wrap">
                        {typeof item.result === "string"
                          ? item.result.substring(0, 200)
                          : JSON.stringify(item.result, null, 2).substring(0, 200)}
                        {((typeof item.result === "string" ? item.result : JSON.stringify(item.result)).length > 200) && "..."}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

