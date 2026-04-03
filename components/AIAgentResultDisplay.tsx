"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Package,
  FileText,
  Bot,
} from "lucide-react";

interface AIAgentResultDisplayProps {
  result: any;
  onCopy?: () => void;
}

export default function AIAgentResultDisplay({ result, onCopy }: AIAgentResultDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  // Parse the result - it could be string JSON or object
  let parsedResult: any = result;
  let isError = false;
  let isJson = false;

  if (typeof result === "string") {
    try {
      parsedResult = JSON.parse(result);
      isJson = true;
      // Check for success field
      if (parsedResult.success === false || parsedResult.error) {
        isError = true;
      }
    } catch {
      // Not JSON, keep as string
      parsedResult = result;
    }
  } else if (parsedResult?.success === false || parsedResult?.error) {
    isError = true;
  }

  // Detect result type and render appropriate display
  const renderMintResult = (data: any) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge className="bg-green-100 text-green-800">
          <Package className="w-3 h-3 mr-1" />
          NFT Minted
        </Badge>
        {data.mode === "proposal" && (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Proposal Mode
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {data.transactionDigest && (
          <div className="p-2 bg-gray-50 rounded">
            <p className="text-xs text-gray-500">Transaction</p>
            <p className="font-mono text-xs truncate">{data.transactionDigest}</p>
          </div>
        )}
        {data.objectId && (
          <div className="p-2 bg-gray-50 rounded">
            <p className="text-xs text-gray-500">Object ID</p>
            <p className="font-mono text-xs truncate">{data.objectId}</p>
          </div>
        )}
        {data.proposalId && (
          <div className="p-2 bg-yellow-50 rounded">
            <p className="text-xs text-gray-500">Proposal ID</p>
            <p className="font-mono text-xs">#{data.proposalId}</p>
          </div>
        )}
      </div>
      {data.message && (
        <p className="text-sm text-gray-700">{data.message}</p>
      )}
    </div>
  );

  const renderTransferResult = (data: any) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge className="bg-blue-100 text-blue-800">
          <TrendingUp className="w-3 h-3 mr-1" />
          Transfer
        </Badge>
        {data.mode === "proposal" && (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Proposal Mode
          </Badge>
        )}
      </div>
      {data.transactionDigest && (
        <div className="p-2 bg-gray-50 rounded">
          <p className="text-xs text-gray-500">Transaction</p>
          <p className="font-mono text-xs truncate">{data.transactionDigest}</p>
        </div>
      )}
      {data.proposalId && (
        <div className="p-2 bg-yellow-50 rounded">
          <p className="text-xs text-gray-500">Proposal ID</p>
          <p className="font-mono text-xs">#{data.proposalId}</p>
        </div>
      )}
      {data.message && (
        <p className="text-sm text-gray-700">{data.message}</p>
      )}
    </div>
  );

  const renderReportResult = (data: any) => {
    const report = data.report || data;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge className="bg-purple-100 text-purple-800">
            <FileText className="w-3 h-3 mr-1" />
            Report
          </Badge>
          {report.period && (
            <Badge variant="outline">{report.period}</Badge>
          )}
        </div>

        {report.nfts && (
          <div className="grid grid-cols-4 gap-2">
            <div className="p-2 bg-gray-50 rounded text-center">
              <p className="text-2xl font-bold text-gray-900">{report.nfts.total || 0}</p>
              <p className="text-xs text-gray-500">Tổng NFT</p>
            </div>
            <div className="p-2 bg-green-50 rounded text-center">
              <p className="text-2xl font-bold text-green-600">{report.nfts.minted || 0}</p>
              <p className="text-xs text-gray-500">Đã mint</p>
            </div>
            <div className="p-2 bg-blue-50 rounded text-center">
              <p className="text-2xl font-bold text-blue-600">{report.nfts.in_transit || 0}</p>
              <p className="text-xs text-gray-500">Đang vận chuyển</p>
            </div>
            <div className="p-2 bg-yellow-50 rounded text-center">
              <p className="text-2xl font-bold text-yellow-600">{report.nfts.at_pharmacy || 0}</p>
              <p className="text-xs text-gray-500">Tại nhà thuốc</p>
            </div>
          </div>
        )}

        {report.transfers && (
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 bg-gray-50 rounded">
              <p className="text-lg font-bold">{report.transfers.total || 0}</p>
              <p className="text-xs text-gray-500">Tổng transfers</p>
            </div>
            <div className="p-2 bg-green-50 rounded">
              <p className="text-lg font-bold text-green-600">{report.transfers.approved || 0}</p>
              <p className="text-xs text-gray-500">Đã duyệt</p>
            </div>
            <div className="p-2 bg-yellow-50 rounded">
              <p className="text-lg font-bold text-yellow-600">{report.transfers.pending || 0}</p>
              <p className="text-xs text-gray-500">Đang chờ</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFraudResult = (data: any) => {
    const fraud = data.fraudDetection || data;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge className="bg-red-100 text-red-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Fraud Detection
          </Badge>
          <Badge variant="outline">{fraud.totalChecked || 0} checked</Badge>
        </div>

        {fraud.summary && (
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 bg-red-50 rounded text-center">
              <p className="text-xl font-bold text-red-600">{fraud.summary.highRisk || 0}</p>
              <p className="text-xs text-gray-500">Cao</p>
            </div>
            <div className="p-2 bg-yellow-50 rounded text-center">
              <p className="text-xl font-bold text-yellow-600">{fraud.summary.mediumRisk || 0}</p>
              <p className="text-xs text-gray-500">Trung bình</p>
            </div>
            <div className="p-2 bg-green-50 rounded text-center">
              <p className="text-xl font-bold text-green-600">{fraud.summary.lowRisk || 0}</p>
              <p className="text-xs text-gray-500">Thấp</p>
            </div>
          </div>
        )}

        {fraud.fraudIndicators && fraud.fraudIndicators.length > 0 && (
          <div className="max-h-[200px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NFT</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fraud.fraudIndicators.slice(0, 5).map((ind: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs">#{ind.nftId}</TableCell>
                    <TableCell className="text-xs">{ind.indicators?.[0]?.type || "N/A"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={ind.riskScore >= 5 ? "destructive" : ind.riskScore >= 3 ? "secondary" : "outline"}
                      >
                        {ind.riskScore}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  };

  const renderHealthResult = (data: any) => {
    const health = data.health || data;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge className={health.status === "healthy" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
            <Bot className="w-3 h-3 mr-1" />
            {health.status === "healthy" ? "Healthy" : "Issues Found"}
          </Badge>
        </div>

        {health.issues && health.issues.length > 0 ? (
          <div className="space-y-2">
            {health.issues.map((issue: any, idx: number) => (
              <div
                key={idx}
                className={`p-2 rounded text-sm ${
                  issue.severity === "critical" ? "bg-red-50 border border-red-200" : "bg-yellow-50 border border-yellow-200"
                }`}
              >
                <p className="font-medium">{issue.type}</p>
                <p className="text-xs opacity-75">{issue.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 bg-green-50 rounded text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <p className="text-sm text-green-800">Hệ thống hoạt động bình thường</p>
          </div>
        )}
      </div>
    );
  };

  const renderAutoApproveResult = (data: any) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Auto Approve
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 bg-green-50 rounded text-center">
          <p className="text-xl font-bold text-green-600">{data.approved || 0}</p>
          <p className="text-xs text-gray-500">Đã duyệt</p>
        </div>
        <div className="p-2 bg-red-50 rounded text-center">
          <p className="text-xl font-bold text-red-600">{data.rejected || 0}</p>
          <p className="text-xs text-gray-500">Bị từ ch拒绝</p>
        </div>
      </div>
    </div>
  );

  // Detect result type and render
  const renderFormattedResult = () => {
    if (isError) {
      return (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <p className="font-medium text-red-800">Lỗi</p>
          </div>
          <p className="text-sm text-red-700">{parsedResult.error || parsedResult.message || "Unknown error"}</p>
          {parsedResult.stack && (
            <details className="mt-2">
              <summary className="text-xs cursor-pointer text-red-600">Chi tiết</summary>
              <pre className="mt-1 p-2 bg-red-100 rounded text-xs overflow-auto">{parsedResult.stack}</pre>
            </details>
          )}
        </div>
      );
    }

    // Detect type based on fields
    if (parsedResult.transactionHash || parsedResult.transactionDigest || parsedResult.objectId) {
      if (parsedResult.transactionHash?.includes("mint") || parsedResult.message?.includes("mint")) {
        return renderMintResult(parsedResult);
      }
      return renderTransferResult(parsedResult);
    }

    if (parsedResult.report || parsedResult.nfts) {
      return renderReportResult(parsedResult);
    }

    if (parsedResult.fraudDetection || parsedResult.fraudIndicators) {
      return renderFraudResult(parsedResult);
    }

    if (parsedResult.status || parsedResult.health) {
      return renderHealthResult(parsedResult);
    }

    if (parsedResult.approved !== undefined || parsedResult.approvedRequests) {
      return renderAutoApproveResult(parsedResult);
    }

    // Default: show as formatted JSON
    return null;
  };

  const formattedResult = renderFormattedResult();

  return (
    <div className="space-y-3">
      {/* Formatted Display */}
      {formattedResult && <div>{formattedResult}</div>}

      {/* Raw JSON Toggle */}
      {isJson && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-500 h-7"
          >
            {expanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronUp className="w-3 h-3 mr-1 rotate-180" />}
            {expanded ? "Ẩn" : "Xem"} JSON
          </Button>

          {expanded && (
            <div className="mt-2 p-3 bg-gray-900 rounded-lg overflow-auto max-h-[400px]">
              <pre className="text-xs text-green-400 whitespace-pre-wrap">
                {JSON.stringify(parsedResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Plain Text Result */}
      {!isJson && !isError && (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <pre className="text-sm text-blue-900 whitespace-pre-wrap">{parsedResult}</pre>
        </div>
      )}
    </div>
  );
}
