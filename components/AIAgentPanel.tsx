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

  const suggestedTasks = {
    manufacturer: [
      "Mint 10 NFT mới từ file Excel",
      "Kiểm tra tất cả NFT đã tạo",
      "Tự động duyệt tất cả transfer requests hợp lệ",
    ],
    distributor: [
      "Phân tích sensor data cho NFT #123",
      "Tự động tạo milestone khi đến địa điểm",
      "Tạo transfer request cho tất cả NFT sẵn sàng",
    ],
    pharmacy: [
      "Tự động duyệt tất cả transfer requests hợp lệ",
      "Xác nhận nhập kho cho tất cả NFT đã nhận",
      "Kiểm tra NFT sắp hết hạn",
    ],
    admin: [
      "Monitor hệ thống và phát hiện vấn đề",
      "Tự động cấp quyền cho ví mới",
      "Tạo báo cáo tổng hợp",
    ],
  };

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
        {role && suggestedTasks[role] && (
          <div>
            <Label className="mb-2 block">Gợi ý nhiệm vụ:</Label>
            <div className="flex flex-wrap gap-2">
              {suggestedTasks[role].map((suggestion, idx) => (
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

