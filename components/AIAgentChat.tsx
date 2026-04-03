"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Send, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  fromCache?: boolean;
}

interface AIAgentChatProps {
  role?: "manufacturer" | "distributor" | "pharmacy" | "admin";
  context?: any;
}

export default function AIAgentChat({ role, context }: AIAgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(`session_${Date.now()}`);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [rateLimit, setRateLimit] = useState<any>(null);

  // Build dynamic suggestions based on context stats
  const getSuggestions = () => {
    if (!role || !context) return [];

    switch (role) {
      case "manufacturer": {
        const stats = context.stats || {};
        return [
          `Mint NFT cho lô thuốc mới - Tôi có ${stats.totalNFTs || 0} NFT (${stats.minted || 0} đã mint, ${stats.inTransit || 0} đang vận chuyển)`,
          `Duyệt transfer requests - ${stats.pendingRequests || 0} request đang chờ, ${stats.approvedRequests || 0} đã duyệt`,
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

  const suggestedPrompts = getSuggestions();

  useEffect(() => {
    // Auto scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai-agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: input,
          context,
          sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Lỗi không xác định");
      }

      const assistantMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        role: "assistant",
        content: typeof data.result === "string" ? data.result : JSON.stringify(data.result, null, 2),
        timestamp: new Date(),
        fromCache: data.fromCache,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setRateLimit(data.rateLimit || null);
    } catch (error: any) {
      const errorMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        role: "assistant",
        content: `❌ Lỗi: ${error.message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-lg">
          <Sparkles className="w-5 h-5 mr-2 text-purple-600" />
          AI Agent Chat
        </CardTitle>
        {rateLimit && (
          <div className="text-xs text-gray-500">
            Rate limit: {rateLimit.remaining} requests còn lại
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages */}
        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
          <div className="space-y-4 py-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <Bot className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Bắt đầu trò chuyện với AI Agent</p>
                {role && suggestedPrompts.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-medium">Gợi ý:</p>
                    {suggestedPrompts.map((prompt, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        onClick={() => setInput(prompt)}
                        className="text-xs"
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-purple-600" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {msg.fromCache && (
                    <Badge variant="outline" className="mb-2 text-xs bg-blue-50">
                      📦 Cached
                    </Badge>
                  )}
                  <pre className="whitespace-pre-wrap text-sm font-sans">
                    {msg.content}
                  </pre>
                  <p className="text-xs opacity-70 mt-1">
                    {msg.timestamp.toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-purple-600" />
                </div>
                <div className="bg-gray-100 rounded-lg p-3">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Nhập nhiệm vụ cho AI Agent..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

