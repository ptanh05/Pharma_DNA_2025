"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Truck,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TransferRequest {
  id: number;
  nft_id: number;
  distributor_address: string;
  pharmacy_address: string | null;
  transfer_note: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
  updated_at: string;
}

interface TransferToPharmacyFormProps {
  selectedNFT: string | null;
  distributorAddress: string;
  onTransferComplete?: () => void;
}

export default function TransferToPharmacyForm({
  selectedNFT,
  distributorAddress,
  onTransferComplete,
}: TransferToPharmacyFormProps) {
  const [pharmacyAddress, setPharmacyAddress] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>(
    []
  );
  const [showTransferRequests, setShowTransferRequests] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Lấy danh sách yêu cầu chuyển lô
  const fetchTransferRequests = async () => {
    try {
      const response = await fetch(
        `/api/distributor/transfer-to-pharmacy?distributor_address=${distributorAddress}`
      );
      if (response.ok) {
        const requests = await response.json();
        setTransferRequests(requests);
      }
    } catch (error) {
      console.error("Error fetching transfer requests:", error);
    }
  };

  useEffect(() => {
    if (distributorAddress) {
      fetchTransferRequests();
    }
  }, [distributorAddress]);

  // Xử lý hiển thị modal xác nhận
  const handleShowConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNFT || !pharmacyAddress) return;
    setShowConfirmModal(true);
  };

  // Xử lý gửi yêu cầu chuyển lô sau khi xác nhận
  const handleConfirmTransfer = async () => {
    if (!selectedNFT || !pharmacyAddress) return;

    setIsSubmitting(true);
    setMessage(null);
    setShowConfirmModal(false);

    try {
      const response = await fetch("/api/distributor/transfer-to-pharmacy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-distributor-address": distributorAddress,
        },
        body: JSON.stringify({
          nft_id: parseInt(selectedNFT),
          pharmacy_address: pharmacyAddress,
          transfer_note: transferNote,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: "success",
          text:
            data.message ||
            `✅ Đã gửi yêu cầu chuyển lô NFT #${selectedNFT} đến nhà thuốc ${pharmacyAddress.slice(
              0,
              6
            )}...${pharmacyAddress.slice(-4)} thành công!`,
        });
        setPharmacyAddress("");
        setTransferNote("");
        fetchTransferRequests();
        onTransferComplete?.();
      } else {
        setMessage({
          type: "error",
          text: data.error || "Có lỗi xảy ra khi gửi yêu cầu",
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Có lỗi xảy ra khi gửi yêu cầu" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Hủy yêu cầu chuyển lô
  const handleCancelRequest = async (requestId: number) => {
    if (!confirm("Bạn có chắc chắn muốn hủy yêu cầu chuyển lô này?")) return;

    try {
      const response = await fetch("/api/distributor/transfer-to-pharmacy", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-distributor-address": distributorAddress,
        },
        body: JSON.stringify({ request_id: requestId }),
      });

      if (response.ok) {
        setMessage({
          type: "success",
          text: "✅ Đã hủy yêu cầu chuyển lô thành công!",
        });
        fetchTransferRequests();
      } else {
        const data = await response.json();
        setMessage({
          type: "error",
          text: data.error || "Có lỗi xảy ra khi hủy yêu cầu",
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Có lỗi xảy ra khi hủy yêu cầu" });
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
  const formatAddress = (address: string | null) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      {/* Form chuyển lô */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Truck className="w-5 h-5 mr-2" />
            Chuyển lô sang nhà thuốc
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedNFT ? (
            <form onSubmit={handleShowConfirm} className="space-y-4">
              <div>
                <Label>NFT ID được chọn</Label>
                <Input value={selectedNFT} disabled className="bg-gray-50" />
              </div>

              <div>
                <Label htmlFor="pharmacyAddress">Địa chỉ nhà thuốc *</Label>
                <Input
                  id="pharmacyAddress"
                  value={pharmacyAddress}
                  onChange={(e) => setPharmacyAddress(e.target.value)}
                  placeholder="0x..."
                  required
                />
              </div>

              <div>
                <Label htmlFor="transferNote">Ghi chú (tùy chọn)</Label>
                <Input
                  id="transferNote"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="Ghi chú về lô thuốc..."
                />
              </div>

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
                      message.type === "success"
                        ? "text-green-800"
                        : "text-red-800"
                    }
                  >
                    {message.text}
                  </AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Đang gửi..." : "Gửi yêu cầu chuyển lô"}
              </Button>
            </form>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Vui lòng chọn một NFT để chuyển lô</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danh sách yêu cầu chuyển lô */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Lịch sử chuyển lô</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTransferRequests(!showTransferRequests)}
            >
              {showTransferRequests ? "Ẩn" : "Hiện"} ({transferRequests.length})
            </Button>
          </CardTitle>
        </CardHeader>
        {showTransferRequests && (
          <CardContent>
            {transferRequests.length > 0 ? (
              <div className="space-y-3">
                {transferRequests.map((request) => (
                  <div key={request.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">
                          NFT #{request.nft_id}
                        </span>
                        {getStatusBadge(request.status)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(request.created_at).toLocaleString("vi-VN")}
                      </div>
                    </div>

                    <div className="text-sm text-gray-600 mb-2">
                      <div>
                        Nhà thuốc: {formatAddress(request.pharmacy_address)}
                      </div>
                      {request.transfer_note && (
                        <div>Ghi chú: {request.transfer_note}</div>
                      )}
                    </div>

                    {request.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelRequest(request.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Hủy yêu cầu
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Chưa có yêu cầu chuyển lô nào</p>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Modal xác nhận chuyển lô */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-yellow-500" />
              Xác nhận chuyển lô thuốc
            </DialogTitle>
            <DialogDescription>
              Vui lòng kiểm tra thông tin trước khi chuyển lô thuốc
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-sm text-gray-700 mb-2">
                Thông tin chuyển lô:
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">NFT ID:</span>
                  <span className="font-mono font-medium">#{selectedNFT}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Nhà thuốc:</span>
                  <span className="font-mono text-xs">{pharmacyAddress}</span>
                </div>
                {transferNote && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ghi chú:</span>
                    <span className="text-right">{transferNote}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Người gửi:</span>
                  <span className="font-mono text-xs">
                    {distributorAddress}
                  </span>
                </div>
              </div>
            </div>

            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                Sau khi xác nhận, yêu cầu chuyển lô sẽ được gửi đến nhà thuốc để
                xem xét và duyệt.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmModal(false)}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button
              onClick={handleConfirmTransfer}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? "Đang gửi..." : "Xác nhận chuyển lô"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
