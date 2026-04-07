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
import DistributorCharts from "@/components/DistributorCharts";
import ActivityFeed from "@/components/ActivityFeed";
import {
  useDistributorNFTs,
  useDistributorTransferRequests,
  useConfirmReceipt,
} from "@/hooks/useDistributorData";

function DistributorContent() {
  const { isConnected, account, isCorrectNetwork, switchToTargetNetwork } =
    useWallet();
  const [contractRole, setContractRole] = useState<number | null>(null);
  const [roleCheckError, setRoleCheckError] = useState<string | null>(null);
  const [selectedNFT, setSelectedNFT] = useState<string | null>(null);
  const [sensorFile, setSensorFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
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

  // React Query hooks (replaces raw useEffect + fetch)
  const { data: nftList = [], isLoading: isNFTsLoading } = useDistributorNFTs(account || undefined);
  const { data: transferReqData = [] } = useDistributorTransferRequests(account || undefined);
  const confirmReceipt = useConfirmReceipt();

  const handleSensorUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSensorFile(e.target.files[0]);
    }
  };

  const handleSelectNFT = (nftId: string) => {
    setSelectedNFT(nftId);
  };

  const confirmReceived = async (tokenId: string) => {
    if (!account) return;
    try {
      await confirmReceipt.mutateAsync({
        nftId: parseInt(tokenId),
        distributorAddress: account,
      });
    } catch (err: any) {
      alert(err.message || "Xác nhận nhận hàng thất bại");
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
        fetch(`/api/manufacturer/nfts?address=${account}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.data.nfts) {
              setNftList(data.data.nfts);
            }
          })
          .catch(() => {});
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
      const res = await fetch("/api/distributor/request-inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nftId: Number(selectedNFT),
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
          .then((data) => {
            if (Array.isArray(data)) setMilestones(data);
            else if (data?.data && Array.isArray(data.data)) setMilestones(data.data);
            else if (data?.milestones && Array.isArray(data.milestones)) setMilestones(data.milestones);
            else setMilestones([]);
          });
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
        const res = await fetch(`/api/admin?address=${account}`, { credentials: "include" });
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
        .then((data) => {
          // Handle different response formats: array directly, {data: []}, {milestones: []}, etc.
          if (Array.isArray(data)) {
            setMilestones(data);
          } else if (data?.data && Array.isArray(data.data)) {
            setMilestones(data.data);
          } else if (data?.milestones && Array.isArray(data.milestones)) {
            setMilestones(data.milestones);
          } else if (data?.success && data?.milestone) {
            setMilestones([data.milestone]);
          } else {
            setMilestones([]);
          }
        })
        .catch(() => setMilestones([]));
    } else {
      setMilestones([]);
    }
  }, [selectedNFT, isUploading]);

  // Lấy danh sách transfer-request khi chọn NFT hoặc account đổi
  useEffect(() => {
    if (selectedNFT && account) {
      fetch(`/api/distributor/request-inventory?distributor_address=${account}`)
        .then((res) => res.json())
        .then((data) => {
          const transferData = Array.isArray(data) ? data : (data?.data ?? []);
          setTransferRequests(transferData);
          const approved = transferData.find(
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
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1 md:mb-2">
          Quản lý vận chuyển
        </h1>
        <p className="text-sm md:text-base text-gray-600">
          Theo dõi và cập nhật trạng thái các lô thuốc đang vận chuyển
        </p>
      </div>

      {/* Charts Section */}
      <div className="mb-6">
        <DistributorCharts address={account || undefined} nftList={nftList} />
      </div>

      {/* Activity Feed */}
      <div className="mb-6">
        <ActivityFeed role="distributor" address={account || undefined} maxItems={8} />
      </div>

      <div className="grid md:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
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
                      className={`p-3 border rounded ${
                        selectedNFT === nft.id ? "bg-blue-50" : ""
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                        <div>
                          <div className="font-mono text-sm">#{nft.id}</div>
                          <div className="text-xs text-gray-600">{nft.name}</div>
                        </div>
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
                      </div>
                      {selectedNFT === nft.id && (
                        <div className="flex flex-col sm:flex-row gap-2 mt-2">
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
                            <span className="hidden sm:inline">Chuyển sang nhà thuốc</span>
                            <span className="sm:hidden">Chuyển nhà thuốc</span>
                          </Button>
                        </div>
                      )}
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
                <div className="space-y-2">
                  {milestones.map((m) => (
                    <div key={m.id} className="border rounded-lg p-2 md:p-3 text-xs md:text-sm">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 mb-1">
                        <span className="font-semibold">{m.type}</span>
                        <span className="text-gray-500 text-xs">{new Date(m.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="text-gray-600">{m.description}</div>
                      <div className="text-gray-500 mt-1">
                        {m.location && <span>📍 {m.location}</span>}
                        {m.actor_address && <span className="ml-2 font-mono">{m.actor_address.slice(0, 10)}...</span>}
                      </div>
                    </div>
                  ))}
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
        <div className="mt-6 md:mt-8">
          <TransferToPharmacyForm
            selectedNFT={selectedNFT}
            distributorAddress={account || ""}
            onTransferComplete={() => {
              setShowTransferForm(false);
            }}
          />
        </div>
      )}

      {/* Approved Transfer Requests - Distributor can sign to transfer */}
      {account && (
        <div className="mt-6 md:mt-8">
          <DistributorTransferApproved distributorAddress={account} />
        </div>
      )}

      {/* AI Agent Panel */}
      <div className="mt-8 md:mt-12">
        <AIAgentPanel
          role="distributor"
          context={{
            account,
            selectedNFT,
            nftList,
            transferRequests,
            stats: {
              totalNFTs: nftList.length,
              minted: nftList.filter((n) => n.status === "minted").length,
              inTransit: nftList.filter((n) => n.status === "in_transit").length,
              pendingRequests: transferRequests.filter((r) => r.status === "pending").length,
              approvedRequests: transferRequests.filter((r) => r.status === "approved").length,
              received: nftList.filter((n) => n.status === "at_pharmacy").length,
            },
          }}
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
