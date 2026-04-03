"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Factory,
  Truck,
  Store,
  ShieldCheck,
  ShieldAlert,
  Search,
} from "lucide-react";

interface MilestoneStep {
  label: string;
  icon: React.ReactNode;
  completed: boolean;
  address?: string;
  timestamp?: string;
  skipped?: boolean;
}

interface LookupResult {
  id: number;
  product_name: string;
  batch_number: string;
  status: string;
  manufacturer_address: string;
  distributor_address?: string;
  pharmacy_address?: string;
  ipfs_hash: string;
  created_at: string;
  expiration_date?: string;
}

function getTrustScore(result: LookupResult): number {
  let score = 0;

  // Completed manufacturer step (always present)
  if (result.manufacturer_address) score += 25;

  // Has distributor address
  if (result.distributor_address) score += 25;

  // Has pharmacy address
  if (result.pharmacy_address) score += 25;

  // Has IPFS hash (metadata integrity)
  if (result.ipfs_hash) score += 15;

  // Has not expired
  if (result.expiration_date) {
    const expiry = new Date(result.expiration_date).getTime();
    if (expiry > Date.now()) score += 10;
  }

  return Math.min(score, 100);
}

function getTrustLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Đáng tin cậy", color: "text-green-600" };
  if (score >= 50) return { label: "Trung bình", color: "text-yellow-600" };
  return { label: "Cảnh báo", color: "text-red-600" };
}

function getSupplyChainSteps(result: LookupResult): MilestoneStep[] {
  const steps: MilestoneStep[] = [
    {
      label: "Nhà sản xuất",
      icon: <Factory className="w-4 h-4" />,
      completed: !!result.manufacturer_address,
      address: result.manufacturer_address,
      timestamp: result.created_at,
    },
    {
      label: "Nhà phân phối",
      icon: <Truck className="w-4 h-4" />,
      completed: !!result.distributor_address,
      address: result.distributor_address,
      skipped: !!result.manufacturer_address && !result.distributor_address,
    },
    {
      label: "Nhà thuốc",
      icon: <Store className="w-4 h-4" />,
      completed: !!result.pharmacy_address,
      address: result.pharmacy_address,
      skipped: !!result.distributor_address && !result.pharmacy_address,
    },
  ];

  return steps;
}

function hasSkippedSteps(steps: MilestoneStep[]): boolean {
  return steps.some((s) => s.skipped);
}

function formatAddress(address?: string): string {
  if (!address) return "Chưa có";
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "N/A";
  try {
    return new Date(dateStr).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "N/A";
  }
}

export default function ConsumerLookup() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ success: boolean; data: LookupResult | null } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/public/lookup?batch=${encodeURIComponent(query)}`);
      const data = await response.json();
      setResult(data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const trustScore = result?.data ? getTrustScore(result.data) : 0;
  const trustInfo = getTrustLabel(trustScore);
  const steps = result?.data ? getSupplyChainSteps(result.data) : [];
  const skippedSteps = hasSkippedSteps(steps);

  return (
    <div className="w-full space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nhập batch number hoặc QR code..."
          className="flex-1 p-3 border rounded-lg"
        />
        <Button onClick={handleSearch} disabled={loading} className="gap-2">
          <Search className="w-4 h-4" />
          {loading ? "..." : "Tra Cứu"}
        </Button>
      </div>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kết quả tra cứu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {result.data ? (
              <>
                {/* Product Info */}
                <div>
                  <h3 className="font-bold text-xl">{result.data.product_name}</h3>
                  <p className="text-gray-500 text-sm">Batch: {result.data.batch_number}</p>
                  {result.data.expiration_date && (
                    <p className="text-gray-500 text-sm">
                      Hạn sử dụng: {formatDate(result.data.expiration_date)}
                    </p>
                  )}
                </div>

                {/* Trust Score */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium flex items-center gap-2">
                      {trustScore >= 50 ? (
                        <ShieldCheck className="w-5 h-5 text-green-600" />
                      ) : (
                        <ShieldAlert className="w-5 h-5 text-red-600" />
                      )}
                      Điểm tin cậy
                    </span>
                    <span className={`font-bold ${trustInfo.color}`}>
                      {trustScore}/100 - {trustInfo.label}
                    </span>
                  </div>
                  <Progress value={trustScore} className="h-2" />
                </div>

                {/* Supply Chain Milestones */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-600 uppercase tracking-wide">
                    Chuỗi cung ứng
                  </h4>
                  <div className="space-y-2">
                    {steps.map((step, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          step.completed
                            ? "bg-green-50 border-green-200"
                            : step.skipped
                            ? "bg-red-50 border-red-200"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div
                          className={`flex-shrink-0 ${
                            step.completed
                              ? "text-green-600"
                              : step.skipped
                              ? "text-red-600"
                              : "text-gray-400"
                          }`}
                        >
                          {step.completed ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : step.skipped ? (
                            <XCircle className="w-5 h-5" />
                          ) : (
                            <Clock className="w-5 h-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{step.icon}</span>
                            <span className="font-medium">{step.label}</span>
                            {step.skipped && (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                Bỏ qua
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {step.completed || step.skipped ? formatAddress(step.address) : "Chưa có dữ liệu"}
                          </p>
                        </div>
                        {step.timestamp && step.completed && (
                          <span className="text-xs text-gray-400">{formatDate(step.timestamp)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Skipped Steps Warning */}
                {skippedSteps && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-700">Cảnh báo: Thiếu bước trong chuỗi cung ứng</p>
                      <p className="text-sm text-red-600 mt-1">
                        Sản phẩm này có thể đã bị bỏ qua một hoặc nhiều bước trong chuỗi cung ứng.
                        Hãy kiểm tra kỹ nguồn gốc sản phẩm trước khi sử dụng.
                      </p>
                    </div>
                  </div>
                )}

                {/* Verification Status */}
                <div className="flex items-center gap-2">
                  {trustScore >= 50 ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className={`font-medium ${trustScore >= 50 ? "text-green-600" : "text-red-600"}`}>
                    {trustScore >= 50 ? "Sản phẩm đã được xác thực trên blockchain" : "Sản phẩm chưa hoàn tất chuỗi cung ứng"}
                  </span>
                </div>

                {/* IPFS Hash */}
                {result.data.ipfs_hash && (
                  <div className="text-xs text-gray-400 break-all">
                    IPFS: {result.data.ipfs_hash}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <XCircle className="w-12 h-12 text-gray-300" />
                <p className="text-gray-500">Không tìm thấy sản phẩm với batch number này</p>
                <p className="text-sm text-gray-400">
                  Vui lòng kiểm tra lại batch number hoặc liên hệ nhà cung cấp
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
