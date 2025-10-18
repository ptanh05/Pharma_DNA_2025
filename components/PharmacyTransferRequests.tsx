"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, Clock, CheckCircle, XCircle, Truck } from "lucide-react";

interface TransferRequest {
  id: number;
  nft_id: number;
  distributor_address: string;
  pharmacy_address: string;
  transfer_note: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
  updated_at: string;
}

interface PharmacyTransferRequestsProps {
  pharmacyAddress: string;
}

export default function PharmacyTransferRequests({
  pharmacyAddress,
}: PharmacyTransferRequestsProps) {
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Lấy danh sách yêu cầu chuyển lô
  const fetchTransferRequests = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/distributor/transfer-to-pharmacy?pharmacy_address=${pharmacyAddress}`
      );
      if (response.ok) {
        const requests = await response.json();
        setTransferRequests(requests);
      }
    } catch (error) {
      console.error("Error fetching transfer requests:", error);
      setMessage({
        type: "error",
        text: "Có lỗi xảy ra khi tải danh sách yêu cầu",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (pharmacyAddress) {
      fetchTransferRequests();
    }
  }, [pharmacyAddress]);

  // Xử lý yêu cầu chuyển lô (approve/reject)
  const handleTransferRequest = async (
    requestId: number,
    status: "approved" | "rejected"
  ) => {
    try {
      const response = await fetch("/api/distributor/transfer-to-pharmacy", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          request_id: requestId,
          status: status,
          pharmacy_address: pharmacyAddress,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: "success",
          text:
            data.message ||
            (status === "approved"
              ? "✅ Đã duyệt yêu cầu chuyển lô thành công! NFT đã được chuyển quyền sở hữu."
              : "❌ Đã từ chối yêu cầu chuyển lô."),
        });
        fetchTransferRequests();
      } else {
        setMessage({
          type: "error",
          text: data.error || "Có lỗi xảy ra khi xử lý yêu cầu",
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Có lỗi xảy ra khi xử lý yêu cầu" });
    }
  };

  // Lấy màu badge theo trạng thái
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Đang chờ
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Đã duyệt
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Từ chối
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-800">
            Đã hủy
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Format địa chỉ
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Lọc yêu cầu theo trạng thái
  const pendingRequests = transferRequests.filter(
    (r) => r.status === "pending"
  );
  const otherRequests = transferRequests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Truck className="w-5 h-5 mr-2" />
            Yêu cầu chuyển lô từ nhà phân phối
          </CardTitle>
        </CardHeader>
        <CardContent>
          {message && (
            <Alert
              className={
                message.type === "success"
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              }
            >
              <AlertDescription
                className={
                  message.type === "success" ? "text-green-800" : "text-red-800"
                }
              >
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-300 animate-pulse" />
              <p>Đang tải danh sách yêu cầu...</p>
            </div>
          ) : transferRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Chưa có yêu cầu chuyển lô nào</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Yêu cầu đang chờ xử lý */}
              {pendingRequests.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 text-yellow-800">
                    Yêu cầu cần xử lý ({pendingRequests.length})
                  </h4>
                  <div className="space-y-3">
                    {pendingRequests.map((request) => (
                      <div
                        key={request.id}
                        className="border border-yellow-200 rounded-lg p-4 bg-yellow-50"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">
                              NFT #{request.nft_id}
                            </span>
                            {getStatusBadge(request.status)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(request.created_at).toLocaleString(
                              "vi-VN"
                            )}
                          </div>
                        </div>

                        <div className="text-sm text-gray-600 mb-3">
                          <div>
                            Nhà phân phối:{" "}
                            {formatAddress(request.distributor_address)}
                          </div>
                          {request.transfer_note && (
                            <div>Ghi chú: {request.transfer_note}</div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              handleTransferRequest(request.id, "approved")
                            }
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleTransferRequest(request.id, "rejected")
                            }
                            className="text-red-600 hover:text-red-700"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Từ chối
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Yêu cầu đã xử lý */}
              {otherRequests.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 text-gray-600">
                    Lịch sử yêu cầu ({otherRequests.length})
                  </h4>
                  <div className="space-y-3">
                    {otherRequests.map((request) => (
                      <div key={request.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">
                              NFT #{request.nft_id}
                            </span>
                            {getStatusBadge(request.status)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(request.updated_at).toLocaleString(
                              "vi-VN"
                            )}
                          </div>
                        </div>

                        <div className="text-sm text-gray-600">
                          <div>
                            Nhà phân phối:{" "}
                            {formatAddress(request.distributor_address)}
                          </div>
                          {request.transfer_note && (
                            <div>Ghi chú: {request.transfer_note}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
