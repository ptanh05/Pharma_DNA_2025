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
import { Textarea } from "@/components/ui/textarea";
import {
  Upload,
  Package,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Database,
  Inbox,
  Search,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWalletSui as useWallet } from "@/hooks/useWalletSui";
import RoleGuard from "@/components/RoleGuard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AIAgentPanel from "@/components/AIAgentPanel";
import { mintNFTWithWallet } from "@/lib/blockchain/client-signing";
import { toast } from "sonner";
import ConfirmTransactionDialog from "@/components/ConfirmTransactionDialog";
import { getExplorerTxUrl } from "@/lib/blockchain/contract";
import ErrorBoundary from "@/components/ErrorBoundary";
import { PageSkeleton } from "@/components/LoadingSkeleton";
import { parseError } from "@/lib/utils/error-handler";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/Pagination";
import SearchBar from "@/components/SearchBar";
import FilterBar, { FilterConfig } from "@/components/FilterBar";
import EmptyState from "@/components/EmptyState";

interface UploadResult {
  success: boolean;
  IpfsHash: string;
  metadata: {
    drugName: string;
    batchNumber: string;
    manufacturingDate: string;
    expiryDate: string;
    description: string;
    manufacturerAddress: string;
    timestamp: string;
    files: string[];
    version: string;
  };
  filesUploaded: number;
  databaseId?: number;
  databaseError?: string;
  message: string;
}

function ManufacturerContent() {
  const { 
    isConnected, 
    account, 
    isCorrectNetwork, 
    switchToTargetNetwork, 
    networkName,
    signAndExecuteTransactionBlock 
  } = useWallet();

  const [formData, setFormData] = useState({
    drugName: "",
    batchNumber: "",
    manufacturingDate: "",
    expiryDate: "",
    description: "",
  });
  const [drugImage, setDrugImage] = useState<File | null>(null);
  const [certificate, setCertificate] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [userList, setUserList] = useState<any[]>([]);
  const [isManufacturer, setIsManufacturer] = useState<boolean>(true);
  const [contractRole, setContractRole] = useState<number | null>(null);
  const [roleCheckError, setRoleCheckError] = useState<string | null>(null);
  const [transferRequests, setTransferRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [showMintConfirmDialog, setShowMintConfirmDialog] = useState(false);
  const [isMinting, setIsMinting] = useState(false);

  // Lấy danh sách user từ backend
  useEffect(() => {
    if (!isConnected || !account) return;
    fetch("/api/admin")
      .then((res) => res.json())
      .then((users) => {
        setUserList(users);
        const myUser = users.find(
          (u: any) => u.address.toLowerCase() === account.toLowerCase()
        );
        setIsManufacturer(myUser?.role === "MANUFACTURER");
      })
      .catch(() => setIsManufacturer(false));
  }, [isConnected, account]);

  // Kiểm tra role thực tế trên contract (qua API)
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
  }, [isConnected, account, uploadStatus]);

  // Lấy danh sách yêu cầu chuyển giao NFT
  useEffect(() => {
    fetch("/api/manufacturer/transfer-request")
      .then((res) => res.json())
      .then((data) => setTransferRequests(data))
      .catch(() => setTransferRequests([]));
  }, [uploadStatus, isApproving]);

  // Filter transfer requests
  const filteredTransferRequests = useMemo(() => {
    let filtered = transferRequests;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (req) =>
          String(req.nft_id).toLowerCase().includes(query) ||
          req.distributor_address?.toLowerCase().includes(query)
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
    items: filteredTransferRequests,
    itemsPerPage: 10,
  });

  useEffect(() => {
    if (isConnected && account && contractRole !== 1) {
      fetch("/api/admin/auto-assign-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: account }),
      })
        .then((res) => res.json())
        .then((data) => {
          // Không reload lại trang nữa
        });
    }
  }, [isConnected, account, contractRole]);

  const approveTransfer = async (
    requestId: number,
    nftId: number,
    distributorAddress: string
  ) => {
    setIsApproving(true);
    try {
      const res = await fetch("/api/manufacturer/transfer-request", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, nftId, distributorAddress }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Chấp thuận thành công!");
        setTransferRequests((prev) => prev.filter((r) => r.id !== requestId));
      } else {
        toast.error("Chấp thuận thất bại", { description: data.error });
      }
    } finally {
      setIsApproving(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setDrugImage(e.target.files[0]);
    }
  };

  const handleCertificateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCertificate(e.target.files[0]);
    }
  };

  const uploadToIPFS = async () => {
    if (!isConnected) {
      toast.error("Vui lòng kết nối ví để tiếp tục");
      return;
    }
    if (!isCorrectNetwork) {
      toast.error(`Vui lòng chuyển sang mạng ${networkName || "đúng"}`);
      return;
    }
    if (!account) {
      toast.error("Không thể lấy địa chỉ ví");
      return;
    }

    setIsUploading(true);
    setUploadStatus("idle");
    setUploadResult(null);

    try {
      const form = new FormData();
      form.append("drugName", formData.drugName);
      form.append("batchNumber", formData.batchNumber);
      form.append("manufacturingDate", formData.manufacturingDate);
      form.append("expiryDate", formData.expiryDate);
      form.append("description", formData.description);
      form.append("manufacturerAddress", account); // Thêm địa chỉ ví
      if (drugImage) form.append("drugImage", drugImage);
      if (certificate) form.append("certificate", certificate);

      const res = await fetch("/api/manufacturer/upload-ipfs", {
        method: "POST",
        body: form,
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setUploadResult(data);
        setUploadStatus("success");
        toast.success("Upload lên IPFS thành công!");
      } else {
        setUploadStatus("error");
        toast.error("Upload thất bại", { description: data.error });
      }
    } catch (error) {
      setUploadStatus("error");
      toast.error("Có lỗi xảy ra khi upload IPFS");
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  // Show confirmation dialog before minting
  const handleMintClick = () => {
    if (!isConnected) {
      toast.error("Vui lòng kết nối ví để tiếp tục");
      return;
    }

    if (!isCorrectNetwork) {
      toast.error(`Vui lòng chuyển sang đúng mạng ${networkName || "đúng"}`);
      return;
    }

    if (!uploadResult?.IpfsHash) {
      toast.error("Chưa có IPFS hash để mint NFT");
      return;
    }

    if (!formData.batchNumber) {
      toast.error("Vui lòng nhập số lô");
      return;
    }

    setShowMintConfirmDialog(true);
  };

  // Execute mint with wallet signing
  const executeMint = async () => {
    if (!isConnected || !account || !signAndExecuteTransactionBlock) {
      toast.error("Ví chưa được kết nối");
      return;
    }

    if (!uploadResult?.IpfsHash || !formData.batchNumber) {
      toast.error("Thiếu thông tin cần thiết");
      return;
    }

    setIsMinting(true);
    setUploadStatus("idle");

    try {
      // Calculate expiry date from form data
      const expiryDate = formData.expiryDate 
        ? new Date(formData.expiryDate).getTime()
        : Math.floor(Date.now()) + (365 * 24 * 60 * 60 * 1000); // Default: 1 year

      // Step 1: Mint NFT with wallet signing
      if (!account) {
        throw new Error("Vui lòng kết nối ví trước khi mint NFT");
      }

      toast.loading("Đang xây dựng transaction...", { id: "mint-tx" });
      
      const mintResult = await mintNFTWithWallet(
        uploadResult.IpfsHash,
        formData.batchNumber,
        account,
        expiryDate,
        signAndExecuteTransactionBlock
      );

      if (!mintResult.success || !mintResult.digest) {
        const errorDetails = parseError(mintResult.error || "Mint NFT thất bại");
        const errorMessage = errorDetails.userMessage || mintResult.error || "Mint NFT thất bại";
        
        // Check if it's a contract signature mismatch error
        if (errorMessage.includes('signature') || errorMessage.includes('Contract function')) {
          toast.error("Lỗi: Contract chưa được cập nhật. Vui lòng liên hệ admin để redeploy contract với Clock parameter.", { 
            id: "mint-tx",
            duration: 10000,
          });
        } else {
          toast.error(`Lỗi: ${errorMessage}`, { 
            id: "mint-tx",
            duration: 5000,
          });
        }
        
        throw new Error(errorMessage);
      }

      toast.success("Transaction đã được ký và gửi!", { id: "mint-tx" });
      toast.loading("Đang lưu NFT vào database...", { id: "save-nft" });

      // Step 2: Get object ID from transaction (we need to fetch it)
      // For now, we'll use the transaction digest and let the backend handle it
      // In production, you should parse the transaction result to get objectId
      
      // Step 3: Save NFT to database
      const saveRes = await fetch("/api/manufacturer/save-nft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectId: mintResult.digest, // Temporary: should be actual objectId
          ipfsHash: uploadResult.IpfsHash,
          account: account,
          batchNumber: formData.batchNumber,
          transactionDigest: mintResult.digest,
        }),
      });

      const saveData = await saveRes.json();

      if (!saveRes.ok) {
        throw new Error(saveData.error || "Lưu NFT vào database thất bại");
      }

      toast.success("Mint NFT thành công!", { 
        id: "save-nft",
        description: `Transaction: ${mintResult.digest?.slice(0, 8) || 'N/A'}...`,
        action: mintResult.digest ? {
          label: "Xem trên Explorer",
          onClick: () => window.open(getExplorerTxUrl(mintResult.digest!), "_blank"),
        } : undefined,
      });

      setUploadStatus("success");

      // Reset form để nhập lô mới
      setTimeout(() => {
        resetForm();
      }, 2000);
    } catch (error: any) {
      setUploadStatus("error");
      const errorDetails = parseError(error);
      
      toast.error("Mint NFT thất bại", { 
        id: "mint-tx",
        description: errorDetails.userMessage,
        duration: 5000,
      });
      
      console.error("Mint NFT error:", errorDetails.message);
    } finally {
      setIsMinting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      drugName: "",
      batchNumber: "",
      manufacturingDate: "",
      expiryDate: "",
      description: "",
    });
    setDrugImage(null);
    setCertificate(null);
    setUploadStatus("idle");
    setUploadResult(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Tạo lô thuốc mới
        </h1>
        <p className="text-gray-600">
          Nhập thông tin lô thuốc và mint NFT trên blockchain
        </p>
      </div>

      {!isConnected && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Vui lòng kết nối ví Sui để sử dụng chức năng này
          </AlertDescription>
        </Alert>
      )}

      {isConnected && !isCorrectNetwork && (
        <Alert className="mb-6 bg-yellow-50 text-yellow-800 border-yellow-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Vui lòng chuyển sang mạng {networkName || "đúng"}</span>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Form Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="w-5 h-5 mr-2" />
              Thông tin lô thuốc
            </CardTitle>
            <CardDescription>
              Điền đầy đủ thông tin về lô thuốc cần tạo NFT
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="drugName">Tên thuốc *</Label>
              <Input
                id="drugName"
                name="drugName"
                value={formData.drugName}
                onChange={handleInputChange}
                placeholder="Ví dụ: Paracetamol 500mg"
                required
                disabled={uploadStatus === "success"}
              />
            </div>

            <div>
              <Label htmlFor="batchNumber">Số lô *</Label>
              <Input
                id="batchNumber"
                name="batchNumber"
                value={formData.batchNumber}
                onChange={handleInputChange}
                placeholder="Ví dụ: LOT2024001"
                required
                disabled={uploadStatus === "success"}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="manufacturingDate">Ngày sản xuất *</Label>
                <Input
                  id="manufacturingDate"
                  name="manufacturingDate"
                  type="date"
                  value={formData.manufacturingDate}
                  onChange={handleInputChange}
                  required
                  disabled={uploadStatus === "success"}
                />
              </div>
              <div>
                <Label htmlFor="expiryDate">Hạn dùng *</Label>
                <Input
                  id="expiryDate"
                  name="expiryDate"
                  type="date"
                  value={formData.expiryDate}
                  onChange={handleInputChange}
                  required
                  disabled={uploadStatus === "success"}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Mô tả</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Thông tin bổ sung về lô thuốc..."
                rows={3}
                disabled={uploadStatus === "success"}
              />
            </div>

            <div>
              <Label htmlFor="drugImage">Ảnh thuốc</Label>
              <Input
                id="drugImage"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploadStatus === "success"}
              />
              {drugImage && (
                <p className="text-sm text-green-600 mt-1">
                  ✓ Đã chọn: {drugImage.name}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="certificate">Chứng chỉ (PDF)</Label>
              <Input
                id="certificate"
                type="file"
                accept=".pdf"
                onChange={handleCertificateUpload}
                disabled={uploadStatus === "success"}
              />
              {certificate && (
                <p className="text-sm text-green-600 mt-1">
                  ✓ Đã chọn: {certificate.name}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Upload className="w-5 h-5 mr-2" />
              Tạo NFT
            </CardTitle>
            <CardDescription>
              Upload metadata lên IPFS và lưu vào database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isConnected && (
              <Alert className="bg-blue-50 text-blue-800 border-blue-200">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Đã kết nối với ví: {account?.slice(0, 6)}...
                  {account?.slice(-4)}
                </AlertDescription>
              </Alert>
            )}

            {uploadStatus === "success" && uploadResult && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  {uploadResult.message}
                  {uploadResult.filesUploaded > 0 && (
                    <span> ({uploadResult.filesUploaded} file đã upload)</span>
                  )}
                  {uploadResult.databaseId && (
                    <div className="flex items-center mt-1">
                      <Database className="w-4 h-4 mr-1" />
                      <span>Database ID: {uploadResult.databaseId}</span>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {uploadResult?.databaseError && (
              <Alert className="bg-yellow-50 text-yellow-800 border-yellow-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {uploadResult.databaseError}
                </AlertDescription>
              </Alert>
            )}

            {uploadStatus === "error" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Có lỗi xảy ra. Vui lòng thử lại.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              {uploadStatus !== "success" ? (
                <>
                  {!isManufacturer && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Ví của bạn chưa được cấp quyền <b>Manufacturer</b> trên
                        hệ thống. Hãy liên hệ admin để được cấp quyền.
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    onClick={uploadToIPFS}
                    disabled={
                      isUploading ||
                      !formData.drugName ||
                      !formData.batchNumber ||
                      !formData.manufacturingDate ||
                      !formData.expiryDate ||
                      !isConnected
                    }
                    className="w-full bg-transparent"
                    variant="outline"
                  >
                    {isUploading
                      ? "Đang upload..."
                      : "Upload lên IPFS & Database"}
                  </Button>
                </>
              ) : (
                <div className="space-y-2">
                  <Button
                    onClick={handleMintClick}
                    disabled={isMinting || !uploadResult || !isConnected}
                    className="w-full"
                  >
                    {isMinting ? "Đang mint NFT..." : "Mint NFT"}
                  </Button>
                  <Button
                    onClick={resetForm}
                    variant="outline"
                    className="w-full bg-transparent"
                  >
                    Tạo lô thuốc mới
                  </Button>
                </div>
              )}
            </div>

            {uploadResult && (
              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div>
                  <h4 className="font-semibold mb-2">IPFS Metadata Hash:</h4>
                  <p className="text-sm font-mono break-all">
                    {uploadResult.IpfsHash}
                  </p>
                  <Button
                    variant="link"
                    className="p-0 h-auto mt-2"
                    onClick={() =>
                      window.open(
                        `https://gateway.pinata.cloud/ipfs/${uploadResult.IpfsHash}`,
                        "_blank"
                      )
                    }
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Xem trên IPFS Gateway
                  </Button>
                </div>

                {uploadResult.databaseId && (
                  <div>
                    <h4 className="font-semibold mb-2">Database Info:</h4>
                    <p className="text-sm">
                      <span className="font-medium">ID:</span>{" "}
                      {uploadResult.databaseId}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Status:</span> CREATED
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Manufacturer:</span>{" "}
                      {account?.slice(0, 6)}...{account?.slice(-4)}
                    </p>
                  </div>
                )}

                {uploadResult.metadata.files.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Files đã upload:</h4>
                    <ul className="text-sm space-y-1">
                      {uploadResult.metadata.files.map((fileHash, index) => (
                        <li key={index} className="flex items-center">
                          <span className="font-mono text-xs break-all">
                            {fileHash}
                          </span>
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto ml-2"
                            onClick={() =>
                              window.open(
                                `https://gateway.pinata.cloud/${fileHash}`,
                                "_blank"
                              )
                            }
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="text-sm text-gray-500 space-y-2">
              <p>
                <strong>Bước 1:</strong> Upload metadata và files lên IPFS
              </p>
              <p>
                <strong>Bước 2:</strong> Lưu thông tin vào database
              </p>
              <p>
                <strong>Bước 3:</strong> Mint NFT với metadata IPFS
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Thêm bảng danh sách yêu cầu chuyển giao NFT */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Yêu cầu nhận lô chờ duyệt</h2>
        </div>

        {/* Search and Filter */}
        <div className="mb-4 space-y-3">
          <SearchBar
            placeholder="Tìm theo NFT ID hoặc địa chỉ distributor..."
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
                ],
              },
            }}
            onFilterChange={(filters) => {
              setStatusFilter(filters.status || "");
            }}
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Lô thuốc (NFT)</TableHead>
              <TableHead>Ví distributor</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8">
                  <EmptyState
                    icon={transferRequests.length === 0 ? Inbox : Search}
                    title={
                      transferRequests.length === 0
                        ? "Chưa có yêu cầu nhận lô nào"
                        : "Không tìm thấy yêu cầu phù hợp"
                    }
                    description={
                      transferRequests.length === 0
                        ? "Các yêu cầu nhận lô từ nhà phân phối sẽ hiển thị ở đây khi có."
                        : "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm để xem kết quả khác."
                    }
                    className="border-0 shadow-none"
                  />
                </TableCell>
              </TableRow>
            ) : (
              paginatedRequests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>{req.id}</TableCell>
                  <TableCell>#{req.nft_id}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {req.distributor_address}
                  </TableCell>
                  <TableCell>
                    {req.status === "approved" ? (
                      <span className="text-green-600 font-semibold">
                        Đã được chấp thuận
                      </span>
                    ) : (
                      req.status
                    )}
                  </TableCell>
                  <TableCell>
                    {req.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() =>
                          approveTransfer(
                            req.id,
                            req.nft_id,
                            req.distributor_address
                          )
                        }
                        disabled={isApproving}
                      >
                        Chấp thuận
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* AI Agent Panel */}
      <div className="mt-12">
        <AIAgentPanel 
          role="manufacturer" 
          context={{ account, isConnected }}
        />
      </div>

      {/* Mint Confirmation Dialog */}
      <ConfirmTransactionDialog
        open={showMintConfirmDialog}
        onOpenChange={setShowMintConfirmDialog}
        onConfirm={executeMint}
        title="Xác nhận Mint NFT"
        description="Bạn sắp mint NFT trên blockchain Sui. Vui lòng kiểm tra thông tin trước khi ký transaction."
        details={[
          { label: "IPFS Hash", value: uploadResult?.IpfsHash?.slice(0, 20) + "..." || "N/A" },
          { label: "Số lô", value: formData.batchNumber || "N/A" },
          { label: "Tên thuốc", value: formData.drugName || "N/A" },
          { label: "Địa chỉ ví", value: account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "N/A" },
        ]}
        type="mint"
      />
    </div>
  );
}

export default function ManufacturerPage() {
  return (
    <RoleGuard requiredRoles={["MANUFACTURER"]}>
      <ManufacturerContent />
    </RoleGuard>
  );
}
