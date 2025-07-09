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
import { Badge } from "@/components/ui/badge";
import { Upload, Package } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";

function DistributorContent() {
  const [selectedNFT, setSelectedNFT] = useState<string | null>(null);
  const [sensorFile, setSensorFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const mockNFTs: any[] = [];

  const handleSensorUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSensorFile(e.target.files[0]);
    }
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
      console.log("TODO: Implement sensor data upload");
      alert("Chức năng upload dữ liệu cảm biến chưa được tích hợp");
      setSensorFile(null);
      setSelectedNFT(null);
    } catch (error) {
      alert("Có lỗi xảy ra");
    } finally {
      setIsUploading(false);
    }
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
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Chưa có lô thuốc nào được giao cho bạn</p>
                <p className="text-sm">
                  Các lô thuốc sẽ hiển thị ở đây khi được chuyển giao
                </p>
              </div>
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
                disabled={!selectedNFT || !sensorFile || isUploading}
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

          {/* Statistics */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Thống kê</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tổng lô đang quản lý:</span>
                  <Badge variant="secondary">{mockNFTs.length}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Đang vận chuyển:</span>
                  <Badge variant="outline">
                    {
                      mockNFTs.filter((nft) => nft.status === "in_transit")
                        .length
                    }
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Đã nhận:</span>
                  <Badge variant="outline">
                    {mockNFTs.filter((nft) => nft.status === "received").length}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function DistributorPage() {
  return (
    <RoleGuard requiredRoles={["DISTRIBUTOR"]}>
      <DistributorContent />
    </RoleGuard>
  );
}
