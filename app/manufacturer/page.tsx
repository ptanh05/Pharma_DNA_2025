"use client";

import type React from "react";

import { useState } from "react";
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
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWallet } from "@/hooks/useWallet";
import RoleGuard from "@/components/RoleGuard";

function ManufacturerContent() {
  const {
    isConnected,
    account,
    isCorrectNetwork,
    switchToEthereum,
    switchToSepolia,
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
  const [ipfsHash, setIpfsHash] = useState("");

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
      alert("Vui lòng chuyển sang mạng Ethereum chính hoặc Sepolia testnet");
      return;
    }

    setIsUploading(true);
    try {
      // TODO: Implement real IPFS upload
      console.log("TODO: Implement IPFS upload");
      setUploadStatus("error");
    } catch (error) {
      setUploadStatus("error");
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
      alert("Vui lòng chuyển sang mạng Ethereum chính hoặc Sepolia testnet");
      return;
    }

    setIsUploading(true);
    try {
      // TODO: Implement real NFT minting
      console.log("TODO: Implement NFT minting");
      alert("Chức năng mint NFT chưa được tích hợp");
    } catch (error) {
      setUploadStatus("error");
    } finally {
      setIsUploading(false);
    }
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
            Vui lòng kết nối ví MetaMask để sử dụng chức năng này
          </AlertDescription>
        </Alert>
      )}

      {isConnected && !isCorrectNetwork && (
        <Alert className="mb-6 bg-yellow-50 text-yellow-800 border-yellow-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Vui lòng chuyển sang mạng Ethereum chính hoặc Sepolia testnet
            </span>
            <div className="flex gap-2 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={switchToEthereum}
                className="bg-transparent"
              >
                Mainnet
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={switchToSepolia}
                className="bg-transparent"
              >
                Sepolia
              </Button>
            </div>
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
              />
            </div>

            <div>
              <Label htmlFor="drugImage">Ảnh thuốc *</Label>
              <Input
                id="drugImage"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                required
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
              Upload metadata lên IPFS và mint NFT
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

            {uploadStatus === "success" && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  {ipfsHash
                    ? `Đã upload lên IPFS: ${ipfsHash}`
                    : "NFT đã được tạo thành công!"}
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
              <Button
                onClick={uploadToIPFS}
                disabled={
                  isUploading ||
                  !formData.drugName ||
                  !formData.batchNumber ||
                  !isConnected
                }
                className="w-full bg-transparent"
                variant="outline"
              >
                {isUploading ? "Đang upload..." : "Upload lên IPFS"}
              </Button>

              <Button
                onClick={mintNFT}
                disabled={isUploading || !ipfsHash || !isConnected}
                className="w-full"
              >
                {isUploading ? "Đang mint NFT..." : "Mint NFT"}
              </Button>
            </div>

            {ipfsHash && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">IPFS Hash:</h4>
                <p className="text-sm font-mono break-all">{ipfsHash}</p>
                <Button variant="link" className="p-0 h-auto mt-2">
                  Xem trên IPFS Gateway
                </Button>
              </div>
            )}

            <div className="text-sm text-gray-500 space-y-2">
              <p>
                <strong>Bước 1:</strong> Upload metadata và file lên IPFS
              </p>
              <p>
                <strong>Bước 2:</strong> Mint NFT với metadata IPFS
              </p>
              <p>
                <strong>Bước 3:</strong> NFT sẽ được gán cho địa chỉ ví của bạn
              </p>
            </div>
          </CardContent>
        </Card>
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
