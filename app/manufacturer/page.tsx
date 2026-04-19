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
  RefreshCw,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWalletSui as useWallet } from "@/hooks/useWalletSui";
import { useRoleAuth } from "@/hooks/useRoleAuth";
import { useManufacturerTransferRequests, useInvalidateManufacturerData, useManufacturerNFTs } from "@/hooks/useManufacturerData";
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
import { getSuiExplorerObjectUrl } from "@/lib/blockchain/config-sui";
import ErrorBoundary from "@/components/ErrorBoundary";
import { PageSkeleton } from "@/components/LoadingSkeleton";
import { parseError } from "@/lib/utils/error-handler";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/Pagination";
import SearchBar from "@/components/SearchBar";
import FilterBar, { FilterConfig } from "@/components/FilterBar";
import EmptyState from "@/components/EmptyState";
import ManufacturerCharts from "@/components/ManufacturerCharts";
import ActivityFeed from "@/components/ActivityFeed";
import { logger } from "@/lib/utils/logger";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [showMintConfirmDialog, setShowMintConfirmDialog] = useState(false);
  const [isMinting, setIsMinting] = useState(false);

  // Lấy role từ hook - không cần gọi API thủ công
  const { userRole, isLoading: isRoleLoading }= useRoleAuth();
  const isManufacturer = userRole === "MANUFACTURER" || userRole === "ADMIN";

  // Lấy danh sách yêu cầu chuyển giao NFT (sử dụng React Query để tận dụng prefetch)
  const { data: transferRequests = [], isLoading: isTransferLoading } = useManufacturerTransferRequests(account || undefined);
  const { data: manufacturerNftsData = [], isLoading: isNftLoading } = useManufacturerNFTs(account || undefined);
  const nfts = Array.isArray(manufacturerNftsData) ? manufacturerNftsData : [];
  const { invalidateTransferRequests, invalidateNFTs } = useInvalidateManufacturerData();

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

  const syncRoleAndRetry = async (address: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/sync-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Đã đồng bộ quyền lên blockchain!`);
        return true;
      }
      // Ép thành string để tránh React error #31
      const errMsg = String(data.detail || data.error || "Không thể đồng bộ");
      toast.error("Đồng bộ quyền thất bại", { description: errMsg });
      return false;
    } catch {
      toast.error("Lỗi khi đồng bộ quyền");
      return false;
    }
  };

  const approveTransfer = async (
    requestId: number,
    nftId: number,
    distributorAddress: string
  ) => {
    // Chấp thuận yêu cầu nhận lô — gọi API duyệt (không cần wallet signing)
    // Distributor sẽ tự thêm thông tin vận chuyển sau khi được duyệt
    setIsApproving(true);
    try {
      const res = await fetch("/api/manufacturer/transfer-request", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          nftId,
          distributorAddress,
          manufacturerAddress: account,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success("Đã duyệt yêu cầu!", {
          description: "Distributor có thể thêm thông tin vận chuyển.",
        });
        invalidateTransferRequests();
        return;
      }

      toast.error("Duyệt thất bại", { description: data.error });
    } catch (error: any) {
      toast.error("Lỗi khi duyệt yêu cầu", { description: error.message });
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
      // Bước 1: Upload trực tiếp lên Pinata từ client (bỏ qua Vercel server)
      let imageIpfsHash = "";
      let certIpfsHash = "";

      // Lấy JWT từ server
      const jwtRes = await fetch("/api/pinata/jwt");
      const jwtData = await jwtRes.json();

      if (!jwtData.jwt) {
        throw new Error("Không thể lấy token upload");
      }

      // Upload ảnh thuốc lên Pinata
      if (drugImage && drugImage.size > 0) {
        const imageFormData = new FormData();
        imageFormData.append("file", drugImage);

        const imageRes = await fetch(
          "https://api.pinata.cloud/pinning/pinFileToIPFS",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${jwtData.jwt}`,
            },
            body: imageFormData,
          }
        );

        if (imageRes.ok) {
          const imageResult = await imageRes.json();
          imageIpfsHash = imageResult.IpfsHash;
        }
      }

      // Upload certificate lên Pinata
      if (certificate && certificate.size > 0) {
        const certFormData = new FormData();
        certFormData.append("file", certificate);

        const certRes = await fetch(
          "https://api.pinata.cloud/pinning/pinFileToIPFS",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${jwtData.jwt}`,
            },
            body: certFormData,
          }
        );

        if (certRes.ok) {
          const certResult = await certRes.json();
          certIpfsHash = certResult.IpfsHash;
        }
      }

      // Bước 2: Gửi metadata nhỏ lên server để lưu DB (không có file)
      const metadata = {
        drugName: formData.drugName,
        batchNumber: formData.batchNumber,
        manufacturingDate: formData.manufacturingDate,
        expiryDate: formData.expiryDate,
        description: formData.description,
        manufacturerAddress: account,
        imageIpfsHash,
        certIpfsHash,
      };

      const res = await fetch("/api/manufacturer/upload-ipfs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadata),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setUploadResult(data);
        setUploadStatus("success");
        toast.success("Upload lên IPFS thành công!");
      } else {
        setUploadStatus("error");
        const errorMsg = data.error || "Upload thất bại";
        toast.error("Upload thất bại", { description: errorMsg });
      }
    } catch (error) {
      setUploadStatus("error");
      toast.error("Có lỗi xảy ra khi upload IPFS");
      logger.error('MANUFACTURER_PAGE', 'Upload error', error);
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

    // Check if user has MANUFACTURER role in DB
    if (!isManufacturer) {
      toast.error("Tài khoản của bạn chưa được cấp quyền MANUFACTURER. Vui lòng liên hệ admin để được cấp quyền.", {
        duration: 8000,
      });
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

    // Check role from DB - if not MANUFACTURER/ADMIN, show specific error
    if (!isManufacturer) {
      toast.error("Tài khoản của bạn chưa được cấp quyền MANUFACTURER. Vui lòng liên hệ admin để được cấp quyền.", {
        duration: 10000,
      });
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
        signAndExecuteTransactionBlock as any
      );
      
      if (!mintResult.success || !mintResult.digest) {
        const errorDetails = parseError(mintResult.error || "Mint NFT thất bại");
        const errorMessage = errorDetails.userMessage || mintResult.error || "Mint NFT thất bại";

        // Log raw error for debugging
        logger.error('MANUFACTURER_PAGE', 'Mint failed', {
          rawError: mintResult.error,
          parsedMessage: errorMessage,
          digest: mintResult.digest
        });

        // Check for user rejection
        if (errorMessage.includes('User rejection') || errorMessage.includes('CN:-4005') || errorMessage.includes('rejected')) {
          toast.info("Bạn đã hủy transaction trên ví Sui. Vui lòng xác nhận transaction trên ví để tiếp tục.", {
            id: "mint-tx",
            duration: 5000,
          });
        } else if (errorMessage.includes('MoveAbort') || errorMessage.includes('abort') || errorMessage.includes('role')) {
          toast.error("Lỗi: Tài khoản của bạn chưa được cấp quyền MANUFACTURER trên blockchain. Vui lòng liên hệ admin để được cấp quyền.", {
            id: "mint-tx",
            duration: 10000,
          });
        } else if (errorMessage.includes('signature') || errorMessage.includes('Contract function')) {
          toast.error("Lỗi: Contract chưa được cập nhật. Vui lòng liên hệ admin để redeploy contract.", {
            id: "mint-tx",
            duration: 10000,
          });
        } else {
          toast.error(`Lỗi: ${errorMessage}`, {
            id: "mint-tx",
            duration: 5000,
          });
        }

        // Try to fetch transaction details to understand the error
        if (mintResult.digest) {
          try {
            const { SuiClient } = await import('@mysten/sui.js/client');
            const { getSuiRpcUrl } = await import('@/lib/blockchain/config-sui');
            const client = new SuiClient({ url: getSuiRpcUrl() });

            const txInfo = await client.getTransactionBlock({
              digest: mintResult.digest,
              options: { showEffects: true }
            });

            logger.debug('MANUFACTURER_PAGE', 'Transaction effects', JSON.stringify(txInfo.effects, null, 2));

            if (txInfo.effects?.status?.status === 'failure') {
              const errorMsg = txInfo.effects?.status?.error || 'Unknown error';
              logger.error('MANUFACTURER_PAGE', 'Transaction failed', errorMsg);

              // Check for specific error codes
              if (errorMsg.includes('abort code 2')) {
                toast.error("Lỗi: Tài khoản chưa được cấp quyền MANUFACTURER trên blockchain", {
                  id: "mint-tx",
                  duration: 10000,
                });
              } else if (errorMsg.includes('abort code 9')) {
                toast.error("Lỗi: Ngày hết hạn phải lớn hơn hiện tại", {
                  id: "mint-tx",
                  duration: 10000,
                });
              } else if (errorMsg.includes('abort code 10')) {
                toast.error("Lỗi: Ngày hết hạn không được quá 10 năm", {
                  id: "mint-tx",
                  duration: 10000,
                });
              } else {
                toast.error(`Chi tiết lỗi: ${errorMsg}`, {
                  id: "mint-tx",
                  duration: 10000,
                });
              }
            }
          } catch (fetchError: any) {
            logger.warn('MANUFACTURER_PAGE', 'Could not fetch transaction details', fetchError.message);
          }
        }
        // Check if it's a contract signature mismatch error
        else if (errorMessage.includes('signature') || errorMessage.includes('Contract function')) {
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
      toast.loading("Đang xác nhận NFT trên blockchain...", { id: "save-nft" });

      // Step 2: Get object ID from transaction result (with retry logic)
      let nftObjectId: string | null = null;
      const maxRetries = 5;
      const initialDelay = 1000; // 1 second
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Fetch transaction details to get created object ID
          // Use SuiClient directly on client-side
          const { SuiClient } = await import('@mysten/sui.js/client');
          const { getSuiRpcUrl } = await import('@/lib/blockchain/config-sui');
          
          const rpcUrl = getSuiRpcUrl();
          const client = new SuiClient({ url: rpcUrl });
          
          logger.debug('MANUFACTURER_PAGE', `Fetching transaction details (attempt ${attempt}/${maxRetries})...`);
          
          const txInfo = await client.getTransactionBlock({
            digest: mintResult.digest!,
            options: {
              showObjectChanges: true,
              showEffects: true,
            },
          });

          // Find the created NFT object
          const createdObjects = txInfo.objectChanges?.filter(
            (change: any) => change.type === 'created'
          ) || [];

          logger.debug('MANUFACTURER_PAGE', `Found ${createdObjects.length} created objects`);
          logger.debug('MANUFACTURER_PAGE', 'Created objects', JSON.stringify(createdObjects, null, 2));

          // Look for PharmaNFT object
          const nftObject = createdObjects.find((obj: any) =>
            obj.objectType?.includes('PharmaNFT') ||
            obj.objectType?.includes('pharma_nft')
          );

          if (nftObject && (nftObject as any).objectId) {
            nftObjectId = (nftObject as any).objectId ?? null;
            break;
          } else if (createdObjects.length > 0) {
            // Fallback: use first created object
            nftObjectId = (createdObjects[0] as any).objectId ?? null;
            break;
          }
        } catch (fetchError: any) {
          logger.warn('MANUFACTURER_PAGE', `Attempt ${attempt} failed`, fetchError.message);

          // If it's the last attempt, we'll use fallback
          if (attempt === maxRetries) {
            logger.warn('MANUFACTURER_PAGE', 'All retry attempts failed, will use transaction digest as fallback');
            break;
          }

          // Wait before retry (exponential backoff)
          const delay = initialDelay * Math.pow(2, attempt - 1);
          logger.debug('MANUFACTURER_PAGE', `Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // If still no object ID, we cannot proceed - show error
      if (!nftObjectId) {
        logger.error('MANUFACTURER_PAGE', 'FATAL: Could not extract object ID after all retries');
        toast.error("Lỗi: Không thể lấy Object ID từ transaction. Transaction có thể đã thất bại.", {
          id: "save-nft",
          action: mintResult.digest ? {
            label: "Xem Transaction",
            onClick: () => window.open(getExplorerTxUrl(mintResult.digest!), "_blank"),
          } : undefined,
        });
        return;
      }

      toast.loading("Đang lưu NFT vào database...", { id: "save-nft" });
      
      // Step 3: Save NFT to database
      const saveRes = await fetch("/api/manufacturer/save-nft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectId: nftObjectId,
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

      // Verify NFT is in wallet (contract automatically transfers to caller)
      let nftInWallet = false;
      let nftOwnerAddress: string | null = null;
      
      if (nftObjectId && account) {
        try {
          const { SuiClient } = await import('@mysten/sui.js/client');
          const { getSuiRpcUrl } = await import('@/lib/blockchain/config-sui');
          const rpcUrl = getSuiRpcUrl();
          const client = new SuiClient({ url: rpcUrl });
          
          // Wait a bit for object to be indexed
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check if NFT object is owned by the account
          const nftObject = await client.getObject({
            id: nftObjectId,
            options: { showOwner: true, showContent: true },
          });
          
          if (nftObject.data?.owner) {
            const owner = typeof nftObject.data.owner === 'string' 
              ? nftObject.data.owner 
              : (nftObject.data.owner as any)?.AddressOwner;
            nftOwnerAddress = owner;
            nftInWallet = owner?.toLowerCase() === account.toLowerCase();
            logger.debug('MANUFACTURER_PAGE', 'NFT ownership verified', { nftObjectId, owner, account, nftInWallet });
          }
        } catch (verifyError: any) {
          logger.warn('MANUFACTURER_PAGE', 'Could not verify NFT ownership', verifyError.message);
          // NFT might still be in wallet, just not indexed yet
          // Contract automatically transfers to sender, so we assume it's in wallet
          nftInWallet = true; // Optimistic - contract transfers automatically
        }
      }

      const successMessage = nftInWallet 
        ? `✅ NFT đã được mint và lưu vào ví của bạn! Object ID: ${nftObjectId?.slice(0, 10)}...`
        : `✅ NFT đã được mint trên blockchain! Object ID: ${nftObjectId?.slice(0, 10)}...`;

      toast.success("Mint NFT thành công!", { 
        id: "save-nft",
        description: successMessage,
        duration: 8000,
        action: nftObjectId ? {
          label: "Xem NFT",
          onClick: () => window.open(getSuiExplorerObjectUrl(nftObjectId!), "_blank"),
        } : mintResult.digest ? {
          label: "Xem Transaction",
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
      
      logger.error('MANUFACTURER_PAGE', 'Mint NFT error', errorDetails.message);
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
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1 md:mb-2">
          Tạo lô thuốc mới
        </h1>
        <p className="text-sm md:text-base text-gray-600">
          Nhập thông tin lô thuốc và mint NFT trên blockchain
        </p>
      </div>

      {/* Charts Section */}
      <div className="mb-6">
        <ManufacturerCharts address={account || undefined} />
      </div>

      {/* Activity Feed */}
      <div className="mb-6">
        <ActivityFeed role="manufacturer" address={account || undefined} maxItems={8} />
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

      <div className="grid md:grid-cols-2 gap-4 md:gap-6 lg:gap-8">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
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
                                `https://gateway.pinata.cloud/ipfs/${fileHash}`,
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

      {/* Danh sách NFT đã tạo */}
      <div className="mt-8 md:mt-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg md:text-xl font-bold">Danh sách NFT đã tạo</h2>
          <Button variant="outline" size="sm" onClick={() => invalidateNFTs()}>
            <Database className="w-4 h-4 mr-2" />
            Làm mới
          </Button>
        </div>

        {nfts.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Chưa có NFT nào được tạo</p>
                <p className="text-sm">Tạo NFT mới bằng cách điền form ở trên</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Tên</TableHead>
                    <TableHead>Số lô</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>IPFS Hash</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nfts.map((nft) => (
                    <TableRow key={nft.id}>
                      <TableCell>{nft.id}</TableCell>
                      <TableCell className="font-medium">{nft.name}</TableCell>
                      <TableCell>{nft.batch_number}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          nft.status === 'minted' ? 'bg-green-100 text-green-800' :
                          nft.status === 'CREATED' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {nft.status === 'minted' ? 'Đã mint' :
                           nft.status === 'CREATED' ? 'Đã tạo' : nft.status}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {(nft as any).ipfs_hash ? `${(nft as any).ipfs_hash.slice(0, 20)}...` : '-'}
                      </TableCell>
                      <TableCell>
                        {nft.created_at ? new Date(nft.created_at).toLocaleDateString('vi-VN') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden grid grid-cols-1 gap-3">
              {nfts.map((nft) => (
                <div key={nft.id} className="border rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-sm">{nft.name}</div>
                      <div className="text-xs text-gray-500">ID: {nft.id} | {nft.batch_number}</div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      nft.status === 'minted' ? 'bg-green-100 text-green-800' :
                      nft.status === 'CREATED' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {nft.status === 'minted' ? 'Đã mint' :
                       nft.status === 'CREATED' ? 'Đã tạo' : nft.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {nft.created_at ? new Date(nft.created_at).toLocaleDateString('vi-VN') : '-'}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thêm bảng danh sách yêu cầu chuyển giao NFT */}
      <div className="mt-8 md:mt-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg md:text-xl font-bold">Yêu cầu nhận lô chờ duyệt</h2>
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

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
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
                      {req.distributor_address ?? 'N/A'}
                    </TableCell>
                    <TableCell>
                      {req.status === "approved" ? (
                        <span className="text-green-600 font-semibold">
                          Đã được chấp thuận
                        </span>
                      ) : req.status === "pending" ? (
                        <span className="text-yellow-600 font-semibold">
                          Chờ duyệt
                        </span>
                      ) : (
                        <span className="text-red-600 font-semibold">
                          {req.status}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {req.status === "pending" && (
                        <Button
                          size="sm"
                          onClick={() =>
                            approveTransfer(
                              req.id as any,
                              req.nft_id as any,
                              req.distributor_address as string
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

        {/* Mobile cards */}
        <div className="md:hidden grid grid-cols-1 gap-3">
          {paginatedRequests.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-gray-500">
                  <Inbox className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{transferRequests.length === 0 ? "Chưa có yêu cầu nhận lô nào" : "Không tìm thấy yêu cầu phù hợp"}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            paginatedRequests.map((req) => (
              <div key={req.id} className="border rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-sm font-medium">#{req.nft_id}</div>
                    <div className="text-xs text-gray-500 font-mono truncate max-w-[150px]">{(req as any).distributor_address ?? 'N/A'}</div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    req.status === "approved" ? "bg-green-100 text-green-800" :
                    req.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    {req.status === "approved" ? "Đã duyệt" : req.status === "pending" ? "Chờ duyệt" : req.status}
                  </span>
                </div>
                {req.status === "pending" && (
                  <Button
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => approveTransfer(req.id as any, req.nft_id as any, req.distributor_address as string)}
                    disabled={isApproving}
                  >
                    Chấp thuận
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* AI Agent Panel */}
      <div className="mt-8 md:mt-12">
        <AIAgentPanel
          role="manufacturer"
          context={{
            account,
            isConnected,
            nfts,
            transferRequests,
            stats: {
              totalNFTs: nfts.length,
              pendingRequests: transferRequests.filter((r) => r.status === "pending").length,
              approvedRequests: transferRequests.filter((r) => r.status === "approved").length,
              rejectedRequests: transferRequests.filter((r) => r.status === "rejected").length,
              minted: nfts.filter((n) => n.status === "minted").length,
              inTransit: nfts.filter((n) => n.status === "in_transit").length,
            },
          }}
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
