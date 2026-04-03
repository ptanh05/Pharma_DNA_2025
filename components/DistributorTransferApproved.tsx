"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, CheckCircle, Truck, Loader2 } from "lucide-react";
import { useWalletSui as useWallet } from "@/hooks/useWalletSui";
import { transferNFTWithWallet } from "@/lib/blockchain/client-signing";
import { toast } from "sonner";
import ConfirmTransactionDialog from "@/components/ConfirmTransactionDialog";
import { getExplorerTxUrl } from "@/lib/blockchain/contract";
import { parseError } from "@/lib/utils/error-handler";
import { useNotifications } from "@/hooks/useNotifications";

interface TransferRequest {
  id: number;
  nft_id: number | string;
  nft_object_id?: string;
  distributor_address: string;
  pharmacy_address: string;
  transfer_note: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
  updated_at: string;
}

interface DistributorTransferApprovedProps {
  distributorAddress: string;
}

export default function DistributorTransferApproved({
  distributorAddress,
}: DistributorTransferApprovedProps) {
  const { account, isConnected, signAndExecuteTransactionBlock } = useWallet();
  const [approvedRequests, setApprovedRequests] = useState<TransferRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [transferringRequestId, setTransferringRequestId] = useState<number | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TransferRequest | null>(null);

  // Use notifications hook for real-time updates
  const { notifications, refresh } = useNotifications(10000);

  // Fetch approved transfer requests
  const fetchApprovedRequests = async () => {
    if (!distributorAddress) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/distributor/transfer-to-pharmacy?distributor_address=${distributorAddress}&status=approved`
      );
      if (response.ok) {
        const result = await response.json();
        const requests = result.data || result;
        setApprovedRequests(Array.isArray(requests) ? requests : []);
      }
    } catch (error) {
      console.error("Error fetching approved requests:", error);
      toast.error("Không thể tải danh sách yêu cầu đã duyệt");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovedRequests();
  }, [distributorAddress]);

  // Refresh when new approved transfer request notifications arrive
  useEffect(() => {
    const approvedNotifications = notifications.filter(
      (n) => n.type === "transfer-request:approved"
    );
    if (approvedNotifications.length > 0) {
      fetchApprovedRequests();
    }
  }, [notifications]);

  // Handle transfer NFT
  const handleTransferClick = (request: TransferRequest) => {
    if (!isConnected || !account) {
      toast.error("Vui lòng kết nối ví để chuyển NFT");
      return;
    }

    if (account.toLowerCase() !== distributorAddress.toLowerCase()) {
      toast.error("Bạn không phải là distributor của yêu cầu này");
      return;
    }

    setSelectedRequest(request);
    setShowConfirmDialog(true);
  };

  const executeTransfer = async () => {
    if (!selectedRequest || !signAndExecuteTransactionBlock || !account) {
      toast.error("Thiếu thông tin cần thiết");
      return;
    }

    setTransferringRequestId(selectedRequest.id);

    try {
      // Get NFT object ID from request - prefer nft_object_id from the joined query
      let objectId: string | null | undefined = selectedRequest.nft_object_id;

      // If not available, try to get from nft_id (fallback for older data)
      if (!objectId) {
        const nftId = typeof selectedRequest.nft_id === 'string'
          ? selectedRequest.nft_id
          : String(selectedRequest.nft_id);

        objectId = nftId.startsWith('0x') ? nftId : await getObjectIdFromNftId(Number(nftId));
      }

      if (!objectId) {
        throw new Error("Không tìm thấy Object ID của NFT");
      }

      toast.loading("Đang xây dựng transaction...", { id: "transfer-tx" });

      // Transfer NFT with wallet signing
      const transferResult = await transferNFTWithWallet(
        objectId!,
        selectedRequest.pharmacy_address,
        account,
        signAndExecuteTransactionBlock as any
      );

      if (!transferResult.success || !transferResult.digest) {
        const errorDetails = parseError(transferResult.error || "Transfer NFT thất bại");
        throw new Error(errorDetails.userMessage || transferResult.error);
      }

      toast.success("Transfer NFT thành công!", {
        id: "transfer-tx",
        description: `Transaction: ${transferResult.digest.slice(0, 8)}...`,
        action: {
          label: "Xem trên Explorer",
          onClick: () => {
            try {
              if (typeof window !== 'undefined') {
                window.open(getExplorerTxUrl(transferResult.digest!), "_blank");
              }
            } catch (error) {
              console.error('Error opening explorer:', error);
            }
          },
        },
      });

      // Refresh list
      fetchApprovedRequests();
    } catch (error: any) {
      const errorDetails = parseError(error);
      toast.error("Transfer NFT thất bại", {
        id: "transfer-tx",
        description: errorDetails.userMessage,
        duration: 5000,
      });
      console.error("Transfer error:", errorDetails.message);
    } finally {
      setTransferringRequestId(null);
    }
  };

  // Helper to get objectId from nft_id (database ID)
  const getObjectIdFromNftId = async (nftId: number): Promise<string | null> => {
    try {
      const response = await fetch(`/api/manufacturer?id=${nftId}`);
      if (response.ok) {
        const data = await response.json();
        return data.token_id || data.object_id || null;
      }
    } catch (error) {
      console.error("Error fetching NFT object ID:", error);
    }
    return null;
  };

  const formatAddress = (address: string | null | undefined) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
            Yêu cầu chuyển lô đã được duyệt
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-gray-300 animate-spin" />
              <p>Đang tải danh sách...</p>
            </div>
          ) : approvedRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Chưa có yêu cầu nào đã được duyệt</p>
            </div>
          ) : (
            <div className="space-y-3">
              {approvedRequests.map((request) => (
                <div
                  key={request.id}
                  className="border border-green-200 rounded-lg p-4 bg-green-50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">NFT #{request.nft_id}</span>
                      <Badge variant="outline" className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Đã duyệt
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(request.updated_at).toLocaleString("vi-VN")}
                    </div>
                  </div>

                  <div className="text-sm text-gray-600 mb-3">
                    <div>
                      Nhà thuốc: {formatAddress(request.pharmacy_address)}
                    </div>
                    {request.transfer_note && (
                      <div>Ghi chú: {request.transfer_note}</div>
                    )}
                  </div>

                  {!isConnected && (
                    <Alert className="mb-3">
                      <AlertDescription>
                        Vui lòng kết nối ví để chuyển NFT
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    size="sm"
                    onClick={() => handleTransferClick(request)}
                    disabled={!isConnected || transferringRequestId === request.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {transferringRequestId === request.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Đang chuyển...
                      </>
                    ) : (
                      <>
                        <Truck className="w-4 h-4 mr-2" />
                        Ký transaction để chuyển NFT
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer Confirmation Dialog */}
      {selectedRequest && (
        <ConfirmTransactionDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
          onConfirm={executeTransfer}
          title="Xác nhận chuyển NFT"
          description="Bạn sắp chuyển quyền sở hữu NFT trên blockchain Sui. Vui lòng kiểm tra thông tin trước khi ký transaction."
          details={[
            { label: "NFT ID", value: String(selectedRequest.nft_id) },
            { label: "Nhà thuốc", value: formatAddress(selectedRequest.pharmacy_address) },
            { label: "Distributor", value: formatAddress(selectedRequest.distributor_address) },
          ]}
          type="transfer"
        />
      )}
    </div>
  );
}

