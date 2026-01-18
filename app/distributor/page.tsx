"use client";

import type React from "react";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, Package, Truck, Plus } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { useWalletSui as useWallet } from "@/hooks/useWalletSui";
import TransferToPharmacyForm from "@/components/TransferToPharmacyForm";
import AIAgentPanel from "@/components/AIAgentPanel";
import DistributorTransferApproved from "@/components/DistributorTransferApproved";
import ErrorBoundary from "@/components/ErrorBoundary";
import { parseError } from "@/lib/utils/error-handler";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/Pagination";
import SearchBar from "@/components/SearchBar";
import FilterBar, { FilterConfig } from "@/components/FilterBar";
import EmptyState from "@/components/EmptyState";

function DistributorContent() {
  const { isConnected, account, isCorrectNetwork, switchToTargetNetwork } =
    useWallet();
  const [contractRole, setContractRole] = useState<number | null>(null);
  const [roleCheckError, setRoleCheckError] = useState<string | null>(null);
  const [selectedNFT, setSelectedNFT] = useState<string | null>(null);
  const [sensorFile, setSensorFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [nftList, setNftList] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [milestoneForm, setMilestoneForm] = useState({
    type: "",
    description: "",
    location: "",
  });
  const [transferRequests, setTransferRequests] = useState<any[]>([]);
  const [canAddMilestone, setCanAddMilestone] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [itemsPerPage, setItemsPerPageState] = useState(10);

  // Lấy danh sách NFT đã mint ra từ manufacturer
  useEffect(() => {
    fetch(`/api/manufacturer`)
      .then((res) => res.json())
      .then((data) => setNftList(data))
      .catch(() => setNftList([]));
  }, []);

  const mockNFTs: any[] = [];

  const handleSensorUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSensorFile(e.target.files[0]);
    }
  };

  const handleSelectNFT = (nftId: string) => {
    setSelectedNFT(nftId);
  };

  const confirmReceived = async (tokenId: string) => {
    setIsUploading(true);
    try {
      console.log("TODO: Implement confirm receipt API");
      alert("Chức năng xác nhận chưa được tích hợp");
    } catch (error) {
      alert("Có lỗi xảy ra");
    } finally {
      setIsUploading(false);
    }
  };

  const uploadSensorData = async () => {
    if (!sensorFile || !selectedNFT) return;
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append("sensorData", sensorFile);
      form.append("nftId", selectedNFT);
      form.append("distributorAddress", account || "");
      const res = await fetch("/api/distributor/upload-sensor", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("Upload dữ liệu cảm biến thành công!");
        setSensorFile(null);
        setSelectedNFT(null);
        fetch(`/api/distributor?address=${account}`)
          .then((res) => res.json())
          .then((data) => setNftList(data))
          .catch(() => setNftList([]));
      } else {
        alert(data.error || "Upload thất bại");
      }
    } catch (error) {
      alert("Có lỗi xảy ra khi upload dữ liệu cảm biến");
      console.error("Upload sensor error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  // Thêm hàm gửi yêu cầu nhận lô
  const requestTransfer = async () => {
    if (!selectedNFT || !account) return;
    setIsUploading(true);
    try {
      const res = await fetch("/api/manufacturer/transfer-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nftId: selectedNFT,
          distributorAddress: account,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(
          "Đã gửi yêu cầu nhận lô thành công. Vui lòng chờ nhà sản xuất chấp thuận!"
        );
        // Có thể cập nhật lại danh sách NFT nếu cần
      } else {
        alert(data.error || "Gửi yêu cầu thất bại");
      }
    } catch (error) {
      alert("Có lỗi xảy ra khi gửi yêu cầu nhận lô");
    } finally {
      setIsUploading(false);
    }
  };

  const handleMilestoneChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setMilestoneForm({ ...milestoneForm, [e.target.name]: e.target.value });
  };
  const submitMilestone = async () => {
    if (!selectedNFT || !account || !milestoneForm.type) return;
    setIsUploading(true);
    try {
      const res = await fetch("/api/manufacturer/milestone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nft_id: selectedNFT,
          type: milestoneForm.type,
          description: milestoneForm.description,
          location: milestoneForm.location,
          actor_address: account,
          timestamp: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("Đã cập nhật mốc vận chuyển!");
        setMilestoneForm({ type: "", description: "", location: "" });
        // Tự động reload lịch sử
        fetch(`/api/manufacturer/milestone?nft_id=${selectedNFT}`)
          .then((res) => res.json())
          .then((data) => setMilestones(data));
      } else {
        alert(data.error || "Cập nhật thất bại");
      }
    } catch (e) {
      alert("Có lỗi khi gửi mốc vận chuyển");
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    const checkRoleOnChain = async () => {
      if (!isConnected || !account) return;
      try {
        const res = await fetch(`/api/admin?address=${account}`);
        if (res.ok) {
          const data = await res.json();
          // Map role string to number: MANUFACTURER=1, DISTRIBUTOR=2, PHARMACY=3
          const roleMap: Record<string, number> = {
            MANUFACTURER: 1,
            DISTRIBUTOR: 2,
            PHARMACY: 3,
          };
          setContractRole(roleMap[data.role] || null);
          setRoleCheckError(null);
        } else {
          setContractRole(null);
          setRoleCheckError(null); // User not found is OK
        }
      } catch (err: any) {
        setContractRole(null);
        setRoleCheckError(
          "Không thể kiểm tra quyền trên contract: " + (err?.message || "")
        );
      }
    };
    checkRoleOnChain();
  }, [isConnected, account]);

  useEffect(() => {
    if (selectedNFT) {
      fetch(`/api/manufacturer/milestone?nft_id=${selectedNFT}`)
        .then((res) => res.json())
        .then((data) => setMilestones(data))
        .catch(() => setMilestones([]));
    } else {
      setMilestones([]);
    }
  }, [selectedNFT, isUploading]);

  // Lấy danh sách transfer-request khi chọn NFT hoặc account đổi
  useEffect(() => {
    if (selectedNFT && account) {
      fetch("/api/manufacturer/transfer-request")
        .then((res) => res.json())
        .then((data) => {
          setTransferRequests(data);
          const approved = data.find(
            (r: any) =>
              r.nft_id == selectedNFT &&
              r.distributor_address?.toLowerCase() === account.toLowerCase() &&
              r.status === "approved"
          );
          setCanAddMilestone(!!approved);
        })
        .catch(() => {
          setTransferRequests([]);
          setCanAddMilestone(false);
        });
    } else {
      setCanAddMilestone(false);
    }
  }, [selectedNFT, account]);

  // Filter NFTs
  const filteredNFTs = useMemo(() => {
    let filtered = nftList;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (nft: any) =>
          String(nft.id).toLowerCase().includes(query) ||
          nft.name?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter((nft: any) => nft.status === statusFilter);
    }

    return filtered;
  }, [nftList, searchQuery, statusFilter]);

  // Pagination
  const {
    currentItems: paginatedNFTs,
    currentPage,
    totalPages,
    totalItems,
    goToPage,
    setItemsPerPage,
  } = usePagination({
    items: filteredNFTs,
    itemsPerPage: itemsPerPage,
  });

  // FIXED: Handler for itemsPerPage change
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPageState(newItemsPerPage);
    setItemsPerPage(newItemsPerPage);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Quản lý vận chuyển
        </h1>
        <p className="text-gray-600">
          Theo dõi và cập nhật trạng thái các lô thuốc đang vận chuyển
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* NFT List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Lô thuốc đang quản lý
              </CardTitle>
              <CardDescription>
                Danh sách các NFT thuốc đang trong quyền sở hữu
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <SearchBar
                  placeholder="Tìm theo NFT ID hoặc tên lô..."
                  onSearch={setSearchQuery}
                />
                <FilterBar
                  filters={{
                    status: {
                      label: "Trạng thái",
                      options: [
                        { label: "Đang vận chuyển", value: "in_transit" },
                        { label: "Đã nhận", value: "received" },
                        { label: "Đã giao", value: "delivered" },
                      ],
                    },
                  }}
                  onFilterChange={(filters) => {
                    setStatusFilter(filters.status || "");
                  }}
                />
              </div>
              {paginatedNFTs.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title={searchQuery || statusFilter ? "Không tìm thấy lô thuốc phù hợp" : "Chưa có lô thuốc nào được giao cho bạn"}
                  description={searchQuery || statusFilter ? "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm để xem kết quả khác." : "Các lô thuốc sẽ hiển thị ở đây khi được chuyển giao từ nhà sản xuất."}
                />
              ) : (
                <>
                  <div className="space-y-2">
                    {paginatedNFTs.map((nft: any) => (
                    <div
                      key={nft.id}
                      className={`p-3 border rounded flex items-center justify-between ${
                        selectedNFT === nft.id ? "bg-blue-50" : ""
                      }`}
                    >
                      <div>
                        <div className="font-mono text-sm">#{nft.id}</div>
                        <div className="text-xs text-gray-600">{nft.name}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={
                            selectedNFT === nft.id ? "default" : "outline"
                          }
                          onClick={() => handleSelectNFT(nft.id)}
                          disabled={isUploading}
                        >
                          {selectedNFT === nft.id ? "Đã chọn" : "Chọn"}
                        </Button>
                        {selectedNFT === nft.id && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={requestTransfer}
                              disabled={isUploading}
                            >
                              Gửi yêu cầu nhận lô
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowTransferForm(true)}
                              className="text-green-600 hover:text-green-700"
                            >
                              <Truck className="w-4 h-4 mr-1" />
                              Chuyển sang nhà thuốc
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
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

        {/* Sensor Upload */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="w-5 h-5 mr-2" />
                Upload dữ liệu AIoT
              </CardTitle>
              <CardDescription>
                Gắn dữ liệu cảm biến vào NFT đã chọn
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedNFT ? (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium">Đã chọn lô:</p>
                  <p className="text-blue-600">#{selectedNFT}</p>
                </div>
              ) : (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    Chọn một lô thuốc để upload dữ liệu
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="sensorData">File dữ liệu cảm biến (JSON)</Label>
                <Input
                  id="sensorData"
                  type="file"
                  accept=".json"
                  onChange={handleSensorUpload}
                  disabled={!selectedNFT}
                />
                {sensorFile && (
                  <p className="text-sm text-green-600 mt-1">
                    ✓ Đã chọn: {sensorFile.name}
                  </p>
                )}
              </div>

              <Button
                onClick={uploadSensorData}
                disabled={
                  !selectedNFT ||
                  !sensorFile ||
                  isUploading ||
                  contractRole !== 2
                }
                className="w-full"
              >
                {isUploading ? "Đang upload..." : "Gắn metadata lên IPFS"}
              </Button>

              <div className="text-xs text-gray-500 space-y-1">
                <p>• Dữ liệu cảm biến bao gồm: nhiệt độ, độ ẩm, vị trí GPS</p>
                <p>• File JSON sẽ được upload lên IPFS</p>
                <p>• Metadata NFT sẽ được cập nhật với hash mới</p>
              </div>
            </CardContent>
          </Card>

          {/* Hiển thị lịch sử vận chuyển nếu đã chọn NFT */}
          {selectedNFT && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Lịch sử vận chuyển</h3>
              {milestones.length === 0 ? (
                <div className="text-sm text-gray-500">
                  Chưa có mốc vận chuyển nào
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs border">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-2 py-1 border">Thời gian</th>
                        <th className="px-2 py-1 border">Loại mốc</th>
                        <th className="px-2 py-1 border">Mô tả</th>
                        <th className="px-2 py-1 border">Vị trí</th>
                        <th className="px-2 py-1 border">Người thực hiện</th>
                      </tr>
                    </thead>
                    <tbody>
                      {milestones.map((m) => (
                        <tr key={m.id}>
                          <td className="border px-2 py-1">
                            {new Date(m.timestamp).toLocaleString()}
                          </td>
                          <td className="border px-2 py-1">{m.type}</td>
                          <td className="border px-2 py-1">{m.description}</td>
                          <td className="border px-2 py-1">{m.location}</td>
                          <td className="border px-2 py-1 font-mono text-xs">
                            {m.actor_address}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Form cập nhật mốc vận chuyển */}
          {selectedNFT &&
            (!canAddMilestone ? (
              <div className="mt-4 mb-6 p-4 bg-yellow-50 rounded-lg text-yellow-800 text-sm">
                Bạn chỉ có thể thêm mốc vận chuyển khi lô này đã được chấp thuận
                giao cho bạn.
              </div>
            ) : (
              <div className="mt-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">Thêm mốc vận chuyển mới</h4>
                <div className="flex flex-col md:flex-row gap-2 items-center">
                  <input
                    className="border px-2 py-1 rounded text-xs"
                    name="type"
                    placeholder="Loại mốc (ví dụ: Nhận hàng, Đang vận chuyển, Giao thành công)"
                    value={milestoneForm.type}
                    onChange={handleMilestoneChange}
                    required
                  />
                  <input
                    className="border px-2 py-1 rounded text-xs"
                    name="location"
                    placeholder="Vị trí (tuỳ chọn)"
                    value={milestoneForm.location}
                    onChange={handleMilestoneChange}
                  />
                  <textarea
                    className="border px-2 py-1 rounded text-xs"
                    name="description"
                    placeholder="Mô tả (tuỳ chọn)"
                    value={milestoneForm.description}
                    onChange={handleMilestoneChange}
                    rows={1}
                  />
                  <Button
                    size="sm"
                    onClick={submitMilestone}
                    disabled={isUploading || !milestoneForm.type}
                  >
                    Gửi mốc
                  </Button>
                </div>
              </div>
            ))}

          {/* Statistics */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Thống kê</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tổng lô đang quản lý:</span>
                  <Badge variant="secondary">{nftList.length}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Đang vận chuyển:</span>
                  <Badge variant="outline">
                    {
                      nftList.filter((nft) => nft.status === "in_transit")
                        .length
                    }
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Đã nhận:</span>
                  <Badge variant="outline">
                    {nftList.filter((nft) => nft.status === "received").length}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Form chuyển lô sang nhà thuốc */}
      {showTransferForm && (
        <div className="mt-8">
          <TransferToPharmacyForm
            selectedNFT={selectedNFT}
            distributorAddress={account || ""}
            onTransferComplete={() => {
              setShowTransferForm(false);
              // Có thể thêm logic refresh data ở đây
            }}
          />
        </div>
      )}

      {/* Approved Transfer Requests - Distributor can sign to transfer */}
      {account && (
        <div className="mt-8">
          <DistributorTransferApproved distributorAddress={account} />
        </div>
      )}

      {/* AI Agent Panel */}
      <div className="mt-12">
        <AIAgentPanel 
          role="distributor" 
          context={{ account, selectedNFT, nftList }}
        />
      </div>
    </div>
  );
}

export default function DistributorPage() {
  return (
    <ErrorBoundary>
      <RoleGuard requiredRoles={["DISTRIBUTOR"]}>
        <DistributorContent />
      </RoleGuard>
    </ErrorBoundary>
  );
}
