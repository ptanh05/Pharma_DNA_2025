"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

interface Proposal {
  id: number;
  type: string;
  proposal_data: any;
  status: string;
  created_by?: string;
  created_at?: string;
  executed_at?: string | null;
  transaction_digest?: string | null;
}

export default function OnChainProposalsPanel() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [error, setError] = useState<string>("");

  const fetchProposals = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/ai-agent/proposals");
      const data = await res.json();
      // Handle both { success: true, data: [...] } and direct array response
      const proposals = data.data || data.proposals || data || [];
      setProposals(Array.isArray(proposals) ? proposals : []);
    } catch (err: any) {
      console.error("Error fetching proposals:", err);
      setError(err.message || "Không thể tải danh sách proposal");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const handleAction = async (id: number, action: "approve" | "reject") => {
    try {
      setActioningId(id);
      setError("");
      const res = await fetch("/api/ai-agent/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Thao tác thất bại");
      }
      await fetchProposals();
      if (data.transactionDigest && typeof window !== "undefined") {
        console.log("Executed tx:", data.transactionDigest);
      }
    } catch (err: any) {
      console.error("Error processing proposal:", err);
      setError(err.message || "Thao tác thất bại");
    } finally {
      setActioningId(null);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Pending
          </Badge>
        );
      case "executed":
        return (
          <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Executed
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Rejected
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>AI On-chain Proposals</CardTitle>
          <CardDescription>
            Danh sách các đề xuất mint/transfer NFT do AI tạo ra (chờ admin duyệt).
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="bg-transparent"
          onClick={fetchProposals}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Đang tải...
            </>
          ) : (
            "Tải lại"
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-sm text-red-600 mb-3">
            {error}
          </p>
        )}

        {proposals.length === 0 && !loading ? (
          <div className="text-center py-8 text-gray-500">
            <p>Chưa có proposal nào.</p>
            <p className="text-xs mt-1">
              Khi AI đề xuất mint/transfer NFT (ở chế độ proposal), chúng sẽ xuất hiện tại đây.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((p) => (
              <div
                key={p.id}
                className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="uppercase text-xs">
                      {p.type}
                    </Badge>
                    {renderStatusBadge(p.status)}
                    <span className="text-xs text-gray-500">
                      #{p.id}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    {p.type === "mint" && (
                      <>
                        <p>
                          <strong>IPFS:</strong> {p.proposal_data?.ipfsHash}
                        </p>
                        <p>
                          <strong>Batch:</strong> {p.proposal_data?.batchNumber}
                        </p>
                        <p>
                          <strong>Manufacturer:</strong>{" "}
                          {p.proposal_data?.manufacturerAddress}
                        </p>
                      </>
                    )}
                    {p.type === "transfer" && (
                      <>
                        <p>
                          <strong>Token:</strong> {p.proposal_data?.tokenId}
                        </p>
                        <p>
                          <strong>From:</strong> {p.proposal_data?.fromAddress}
                        </p>
                        <p>
                          <strong>To:</strong> {p.proposal_data?.toAddress}
                        </p>
                      </>
                    )}
                    {p.created_by && (
                      <p>
                        <strong>Tạo bởi:</strong> {p.created_by}
                      </p>
                    )}
                    {p.created_at && (
                      <p>
                        <strong>Tạo lúc:</strong>{" "}
                        {new Date(p.created_at).toLocaleString()}
                      </p>
                    )}
                    {p.executed_at && (
                      <p>
                        <strong>Thực thi lúc:</strong>{" "}
                        {new Date(p.executed_at).toLocaleString()}
                      </p>
                    )}
                    {p.transaction_digest && (
                      <p>
                        <strong>Tx:</strong>{" "}
                        <code className="bg-gray-100 px-1 rounded">
                          {p.transaction_digest}
                        </code>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-transparent text-green-700 hover:text-green-800 hover:bg-green-50"
                    disabled={p.status !== "pending" || actioningId === p.id}
                    onClick={() => handleAction(p.id, "approve")}
                  >
                    {actioningId === p.id ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                    )}
                    Duyệt & chạy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-transparent text-red-700 hover:text-red-800 hover:bg-red-50"
                    disabled={p.status !== "pending" || actioningId === p.id}
                    onClick={() => handleAction(p.id, "reject")}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Từ chối
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


