"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Bot, CheckCircle, XCircle, MessageSquare, History } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AIAgentChat from "@/components/AIAgentChat";
import AIAgentTaskHistory from "@/components/AIAgentTaskHistory";

interface AIAgentPanelProps {
  role?: "manufacturer" | "distributor" | "pharmacy" | "admin";
  context?: any;
}

export default function AIAgentPanel({ role, context }: AIAgentPanelProps) {
  const [task, setTask] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(`session_${Date.now()}`);
  const [rateLimit, setRateLimit] = useState<any>(null);
  const [isFromCache, setIsFromCache] = useState(false);

  // Build dynamic suggestions based on context stats
  const getSuggestions = () => {
    if (!role || !context) return [];

    switch (role) {
      case "manufacturer": {
        const stats = context.stats || {};
        return [
          `Mint NFT mới - Tôi có ${stats.totalNFTs || 0} NFT (${stats.minted || 0} đã mint, ${stats.inTransit || 0} đang vận chuyển)`,
          `Duyệt transfer requests - Có ${stats.pendingRequests || 0} request đang chờ, ${stats.approvedRequests || 0} đã duyệt, ${stats.rejectedRequests || 0} bị từ chối`,
          `Tổng quan hoạt động sản xuất - Báo cáo chi tiết về ${stats.totalNFTs || 0} lô thuốc đã tạo`,
        ];
      }
      case "distributor": {
        const stats = context.stats || {};
        return [
          `Phân tích tình trạng - Tôi có ${stats.totalNFTs || 0} NFT (${stats.minted || 0} đã mint, ${stats.inTransit || 0} đang vận chuyển, ${stats.received || 0} đã nhận)`,
          `Tạo milestone cho NFTs đang vận chuyển - Có ${stats.inTransit || 0} NFT đang trên đường`,
          `Transfer requests - ${stats.pendingRequests || 0} request chờ duyệt, ${stats.approvedRequests || 0} đã duyệt`,
        ];
      }
      case "pharmacy": {
        const stats = context.stats || {};
        return [
          `Tổng quan kho thuốc - ${stats.totalInventory || 0} lô (${stats.inStock || 0} trong kho, ${stats.inTransit || 0} đang vận chuyển, ${stats.dispensed || 0} đã bán, ${stats.expired || 0} hết hạn)`,
          `Xử lý transfer requests - Có ${stats.pendingTransfers || 0} request đang chờ duyệt`,
          `Kiểm tra thuốc hết hạn - Tìm các lô thuốc sắp hết hạn hoặc đã hết hạn trong kho`,
        ];
      }
      case "admin": {
        const stats = context.stats || {};
        return [
          `Monitor hệ thống - Tổng cộng ${stats.totalUsers || 0} users, ${stats.totalNFTs || 0} NFTs trên blockchain`,
          `Phát hiện gian lận - Scan toàn bộ chuỗi cung ứng và phát hiện bất thường`,
          `Tạo báo cáo tổng hợp - Phân tích hoạt động của ${stats.manufacturers || 0} nhà sản xuất, ${stats.distributors || 0} nhà phân phối, ${stats.pharmacies || 0} nhà thuốc`,
        ];
      }
      default:
        return [];
    }
  };

  const suggestedTasks = getSuggestions();

  const handleExecute = async () => {
    if (!task.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/ai-agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          context,
          sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(data.error || "Rate limit exceeded. Vui lòng đợi một chút.");
        }
        throw new Error(data.error || "Lỗi không xác định");
      }

      setResult(data);
      setIsFromCache(data.fromCache || false);
      setRateLimit(data.rateLimit || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Bot className="w-5 h-5 mr-2" />
          AI Orchestrator Agent
        </CardTitle>
        <CardDescription>
          Agent tự động điều phối chuỗi cung ứng. Giao nhiệm vụ và agent sẽ thực hiện.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="chat" className="space-y-4">
          <TabsList>
            <TabsTrigger value="chat" className="flex items-center">
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="task" className="flex items-center">
              <Bot className="w-4 h-4 mr-2" />
              Task
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center">
              <History className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Chat Interface */}
          <TabsContent value="chat">
            <AIAgentChat role={role} context={context} />
          </TabsContent>

          {/* Task Interface (Original) */}
          <TabsContent value="task" className="space-y-4">
        {/* Suggested Tasks */}
        {suggestedTasks.length > 0 && (
          <div>
            <Label className="mb-2 block">Gợi ý nhiệm vụ:</Label>
            <div className="flex flex-wrap gap-2">
              {suggestedTasks.map((suggestion, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => setTask(suggestion)}
                  disabled={isLoading}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Task Input */}
        <div>
          <Label htmlFor="task">Nhiệm vụ cho Agent</Label>
          <Textarea
            id="task"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Ví dụ: Mint NFT cho lô thuốc Paracetamol, số lô LOT2024001, IPFS hash QmXXX..."
            rows={4}
            disabled={isLoading}
          />
        </div>

        <Button
          onClick={handleExecute}
          disabled={isLoading || !task.trim()}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Đang xử lý...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Thực thi
            </>
          )}
        </Button>

        {/* Result */}
        {result && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {isFromCache && (
                <Badge variant="outline" className="mb-2 bg-blue-50 text-blue-700">
                  📦 Kết quả từ cache
                </Badge>
              )}
              <div className="font-semibold mb-2">Kết quả:</div>
              <pre className="whitespace-pre-wrap text-sm">
                {typeof result.result === "string"
                  ? result.result
                  : JSON.stringify(result.result, null, 2)}
              </pre>
              {result.steps && result.steps.length > 0 && (
                <div className="mt-2">
                  <div className="font-semibold">Các bước đã thực hiện:</div>
                  <ul className="list-disc list-inside text-sm mt-1">
                    {result.steps.map((step: any, idx: number) => (
                      <li key={idx}>{step.action || step.tool || "Step"}</li>
                    ))}
                  </ul>
                </div>
              )}
              {rateLimit && (
                <div className="mt-2 text-xs text-gray-600">
                  Rate limit: {rateLimit.remaining} requests còn lại
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Info */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>💡 Agent có thể:</p>
          <ul className="list-disc list-inside ml-2">
            <li>Mint và transfer NFT</li>
            <li>Tạo milestones</li>
            <li>Phân tích sensor data</li>
            <li>Gửi thông báo</li>
            <li>Truy vấn database</li>
          </ul>
        </div>
          </TabsContent>

          {/* History */}
          <TabsContent value="history">
            <AIAgentTaskHistory sessionId={sessionId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

