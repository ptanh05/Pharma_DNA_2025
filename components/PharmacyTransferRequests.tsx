"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, Clock, CheckCircle, XCircle, Truck, Inbox, Search } from "lucide-react";
import { toast } from "sonner";
import { useNotifications } from "@/hooks/useNotifications";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/Pagination";
import SearchBar from "@/components/SearchBar";
import FilterBar from "@/components/FilterBar";
import EmptyState from "@/components/EmptyState";

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
  onApproved?: () => void;
}

export default function PharmacyTransferRequests({
  pharmacyAddress,
  onApproved,
}: PharmacyTransferRequestsProps) {
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [itemsPerPage, setItemsPerPageState] = useState(10);
  const { notifications } = useNotifications();

  // Lấy danh sách yêu cầu chuyển lô
  const fetchTransferRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/distributor/transfer-to-pharmacy?pharmacy_address=${pharmacyAddress}`
      );
      if (response.ok) {
        const result = await response.json();
        // Handle both direct array or { success: true, data: [...] } format
        const requests = result.data || result;
        setTransferRequests(Array.isArray(requests) ? requests : []);
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
  }, [pharmacyAddress]);

  useEffect(() => {
    if (pharmacyAddress) {
      fetchTransferRequests();
    }
  }, [pharmacyAddress, fetchTransferRequests]);

  // Refresh when new transfer request notifications arrive
  useEffect(() => {
    const transferNotifications = notifications.filter(
      (n) => n.type === "transfer-request:created" || n.type === "transfer-request:updated"
    );
    if (transferNotifications.length > 0) {
      fetchTransferRequests();
    }
  }, [notifications, fetchTransferRequests]);

  // Xử lý yêu cầu chuyển lô (approve/reject) - auto nhập kho khi duyệt
  const handleTransferRequest = async (
    requestId: number,
    status: "approved" | "rejected"
  ) => {
    try {
      // First, get the request details to get nft_id
      const getRes = await fetch(`/api/distributor/transfer-to-pharmacy?pharmacy_address=${pharmacyAddress}`);
      const getData = await getRes.json();
      const requests = getData.data || getData;
      const request = requests.find((r: any) => r.id === requestId);

      if (!request) {
        toast.error("Không tìm thấy yêu cầu");
        return;
      }

      // Update transfer request status
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

      if (!response.ok) {
        const errorMsg = data.error || "Có lỗi xảy ra khi xử lý yêu cầu";
        toast.error("Xử lý yêu cầu thất bại", { description: errorMsg });
        setMessage({ type: "error", text: errorMsg });
        return;
      }

      if (status === "approved") {
        // Auto confirm receipt - nhập kho luôn
        try {
          const confirmRes = await fetch("/api/pharmacy/auto-confirm-receipt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nftId: request.nft_id,
              pharmacyAddress: pharmacyAddress,
              quantity: 1,
            }),
          });

          if (confirmRes.ok) {
            toast.success("Đã duyệt và nhập kho thành công!");
            setMessage({ type: "success", text: "✅ Đã duyệt và nhập kho thành công!" });
            onApproved?.();
          } else {
            const confirmData = await confirmRes.json();
            toast.warning("Đã duyệt nhưng nhập kho thất bại", {
              description: confirmData.error || "Cần xác nhận thủ công",
            });
            setMessage({ type: "success", text: "✅ Đã duyệt yêu cầu (nhập kho thất bại)" });
            onApproved?.();
          }
        } catch (confirmError) {
          console.error("Confirm receipt error:", confirmError);
          toast.warning("Đã duyệt nhưng nhập kho thất bại");
          setMessage({ type: "success", text: "✅ Đã duyệt yêu cầu (nhập kho thất bại)" });
          onApproved?.();
        }
      } else {
        toast.success("Đã từ chối yêu cầu chuyển lô");
        setMessage({ type: "success", text: "❌ Đã từ chối yêu cầu chuyển lô." });
      }

      fetchTransferRequests();
    } catch (error) {
      console.error("Handle transfer request error:", error);
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
  const formatAddress = (address: string | null | undefined) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Filter transfer requests
  const filteredRequests = useMemo(() => {
    let filtered = transferRequests;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (req) =>
          String(req.nft_id).toLowerCase().includes(query) ||
          req.distributor_address?.toLowerCase().includes(query) ||
          req.transfer_note?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter((req) => req.status === statusFilter);
    }

    return filtered;
  }, [transferRequests, searchQuery, statusFilter]);

  // Pagination
  const {
    currentItems: paginatedRequests,
    currentPage,
    totalPages,
    totalItems,
    goToPage,
    setItemsPerPage,
  } = usePagination({
    items: filteredRequests,
    itemsPerPage: itemsPerPage,
  });

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPageState(newItemsPerPage);
    setItemsPerPage(newItemsPerPage);
  };

  // Lọc yêu cầu theo trạng thái (from paginated requests)
  const pendingRequests = paginatedRequests.filter(
    (r) => r.status === "pending"
  );
  const otherRequests = paginatedRequests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Truck className="w-5 h-5 mr-2" />
            Yêu cầu chuyển lô từ nhà phân phối
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter */}
          <div className="space-y-3">
            <SearchBar
              placeholder="Tìm theo NFT ID, distributor hoặc ghi chú..."
              onSearch={setSearchQuery}
            />
            <FilterBar
              filters={{
                status: {
                  label: "Trạng thái",
                  options: [
                    { label: "Chờ duyệt", value: "pending" },
                    { label: "Đã duyệt", value: "approved" },
                    { label: "Đã từ chối", value: "rejected" },
                    { label: "Đã hủy", value: "cancelled" },
                  ],
                },
              }}
              onFilterChange={(filters) => {
                setStatusFilter(filters.status || "");
              }}
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
          ) : paginatedRequests.length === 0 ? (
            <EmptyState
              icon={transferRequests.length === 0 ? Inbox : Search}
              title={transferRequests.length === 0 ? "Chưa có yêu cầu chuyển lô nào" : "Không tìm thấy yêu cầu phù hợp"}
              description={transferRequests.length === 0 ? "Các yêu cầu chuyển lô từ nhà phân phối sẽ hiển thị ở đây khi có." : "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm để xem kết quả khác."}
            />
          ) : (
            <>
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
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={goToPage}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
