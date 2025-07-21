"use client";

import type React from "react";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWallet } from "@/hooks/useWallet";
import RoleGuard from "@/components/RoleGuard";
import { ethers } from "ethers";
import pharmaNFTAbi from "@/lib/pharmaNFT-abi.json";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  const { isConnected, account, isCorrectNetwork, switchToSaga } = useWallet();

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
  const [isApproving, setIsApproving] = useState(false);

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

  // Kiểm tra role thực tế trên contract
  useEffect(() => {
    const checkRoleOnChain = async () => {
      if (!isConnected || !account) return;
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(
          contractAddress,
          pharmaNFTAbi.abi || pharmaNFTAbi,
          provider
        );
        const role = await contract.roles(account);
        setContractRole(Number(role));
        setRoleCheckError(null);
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

  useEffect(() => {
    if (isConnected && account && contractRole !== 1) {
      fetch("/api/admin/auto-assign-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: account }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setTimeout(() => window.location.reload(), 8000);
          }
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
        alert("Chấp thuận thành công!");
        setTransferRequests((prev) => prev.filter((r) => r.id !== requestId));
      } else {
        alert(data.error || "Chấp thuận thất bại");
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
      alert("Vui lòng kết nối ví để tiếp tục");
      return;
    }
    if (!isCorrectNetwork) {
      alert("Vui lòng chuyển sang mạng Saga (sagent)");
      return;
    }
    if (!account) {
      alert("Không thể lấy địa chỉ ví");
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
      } else {
        setUploadStatus("error");
        alert(data.error || "Upload thất bại");
      }
    } catch (error) {
      setUploadStatus("error");
      alert("Có lỗi xảy ra khi upload IPFS");
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const mintNFT = async () => {
    if (!isConnected) {
      alert("Vui lòng kết nối ví để tiếp tục");
      return;
    }

    if (!isCorrectNetwork) {
      alert("Vui lòng chuyển sang đúng mạng Saga");
      return;
    }

    if (!uploadResult?.IpfsHash) {
      alert("Chưa có IPFS hash để mint NFT");
      return;
    }

    setIsUploading(true);
    setUploadStatus("idle");
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        contractAddress,
        pharmaNFTAbi.abi || pharmaNFTAbi,
        signer
      );
      // Log để debug
      console.log("Minting with account:", account);
      console.log("IPFS Hash:", uploadResult.IpfsHash);
      console.log("Contract address:", contractAddress);
      const tx = await contract.mintProductNFT(uploadResult.IpfsHash);
      await tx.wait();
      setUploadStatus("success");
      alert("Mint NFT thành công!");
    } catch (error: any) {
      setUploadStatus("error");
      if (
        error?.message?.includes("Invalid role") ||
        error?.message?.includes("revert")
      ) {
        alert(
          "Ví của bạn chưa được cấp quyền Manufacturer trên contract. Hãy liên hệ admin để được cấp quyền."
        );
      } else {
        alert(error?.message || "Mint NFT thất bại");
      }
      console.error("Mint NFT error:", error);
    } finally {
      setIsUploading(false);
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

  const contractAddress =
    process.env.PHARMA_NFT_ADDRESS ||
    "0xaa3f88a6b613985f3D97295D6BAAb6246c2699c6";

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
            Vui lòng kết nối ví MetaMask để sử dụng chức năng này
          </AlertDescription>
        </Alert>
      )}

      {isConnected && !isCorrectNetwork && (
        <Alert className="mb-6 bg-yellow-50 text-yellow-800 border-yellow-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Vui lòng chuyển sang mạng Saga (sagent)</span>
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
                  {contractRole !== null && contractRole !== 1 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Ví của bạn chưa được cấp quyền <b>Manufacturer</b> trên
                        contract. Hãy liên hệ admin để được cấp quyền trên
                        blockchain.
                        <br />
                        <span className="text-xs text-gray-500">
                          (contractRole: {String(contractRole)})
                        </span>
                        {roleCheckError && (
                          <span className="text-xs text-gray-500">
                            {roleCheckError}
                          </span>
                        )}
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
                      !isConnected ||
                      !isManufacturer ||
                      contractRole !== 1
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
                    onClick={mintNFT}
                    disabled={
                      isUploading ||
                      !uploadResult ||
                      !isConnected ||
                      !isManufacturer ||
                      contractRole !== 1
                    }
                    className="w-full"
                  >
                    {isUploading ? "Đang mint NFT..." : "Mint NFT"}
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
        <h2 className="text-xl font-bold mb-4">Yêu cầu nhận lô chờ duyệt</h2>
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
            {transferRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500">
                  Không có yêu cầu nào
                </TableCell>
              </TableRow>
            ) : (
              transferRequests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>{req.id}</TableCell>
                  <TableCell>#{req.nft_id}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {req.distributor_address}
                  </TableCell>
                  <TableCell>{req.status}</TableCell>
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
