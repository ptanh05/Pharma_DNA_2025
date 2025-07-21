"use client";

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
import {
  QrCode,
  Search,
  Shield,
  AlertTriangle,
  CheckCircle,
  MapPin,
  Calendar,
} from "lucide-react";
import QRScanner from "@/components/QRScanner";
import Image from "next/image";
import { useEffect } from "react";

// Mock drug data for public lookup
const mockPublicData: Record<string, any> = {};

export default function LookupPage() {
  const [scanMode, setScanMode] = useState<"qr" | "manual">("qr");
  const [tokenId, setTokenId] = useState("");
  const [batchName, setBatchName] = useState("");
  const [drugData, setDrugData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [milestones, setMilestones] = useState<any[]>([]);

  const handleQRScan = (result: string) => {
    setTokenId(result);
    lookupDrug(result);
  };

  const lookupDrug = async (name: string) => {
    setIsLoading(true);
    try {
      // Lấy thông tin NFT theo name
      const nftRes = await fetch(
        `/api/manufacturer?name=${encodeURIComponent(name)}`
      );
      const nftData = await nftRes.json();
      if (!nftRes.ok || !nftData || !nftData.id) {
        setDrugData(null);
        setMilestones([]);
        alert("Không tìm thấy lô thuốc với tên này");
        setIsLoading(false);
        return;
      }
      setDrugData(nftData);
      // Lấy lịch sử vận chuyển
      const msRes = await fetch(
        `/api/manufacturer/milestone?nft_id=${nftData.id}`
      );
      const msData = await msRes.json();
      setMilestones(msData || []);
    } catch (error) {
      alert("Có lỗi xảy ra khi tra cứu");
      setDrugData(null);
      setMilestones([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "authentic":
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case "warning":
      case "not_found":
        return <AlertTriangle className="w-6 h-6 text-red-600" />;
      default:
        return <Shield className="w-6 h-6 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "authentic":
        return "bg-green-100 text-green-800 border-green-200";
      case "warning":
      case "not_found":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Tra cứu nguồn gốc thuốc
        </h1>
        <p className="text-gray-600">
          Xác minh tính xác thực và nguồn gốc của thuốc chỉ với một lần quét
        </p>
        <div className="mt-4 p-4 bg-blue-50 rounded-lg inline-block">
          <p className="text-sm text-blue-800">
            <Shield className="w-4 h-4 inline mr-1" />
            Dịch vụ miễn phí - Không cần kết nối ví
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Scanner Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <QrCode className="w-5 h-5 mr-2" />
              Quét mã QR trên hộp thuốc
            </CardTitle>
            <CardDescription>
              Sử dụng camera để quét QR hoặc nhập Token ID thủ công
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 mb-4">
              <Button
                variant={scanMode === "qr" ? "default" : "outline"}
                onClick={() => setScanMode("qr")}
                size="sm"
              >
                <QrCode className="w-4 h-4 mr-1" />
                Quét QR
              </Button>
              <Button
                variant={scanMode === "manual" ? "default" : "outline"}
                onClick={() => setScanMode("manual")}
                size="sm"
              >
                <Search className="w-4 h-4 mr-1" />
                Nhập mã
              </Button>
            </div>

            {scanMode === "qr" ? (
              <QRScanner onScan={handleQRScan} />
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="batchName">Tên lô thuốc</Label>
                  <Input
                    id="batchName"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    placeholder="Nhập tên lô thuốc (ví dụ: Paracetamol 500mg - LOT2024001)"
                  />
                </div>
                <Button
                  onClick={() => lookupDrug(batchName)}
                  disabled={!batchName || isLoading}
                  className="w-full"
                >
                  {isLoading ? "Đang tra cứu..." : "Tra cứu"}
                </Button>
              </div>
            )}

            {/* Demo buttons */}
            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 mb-2">Thử nghiệm:</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => lookupDrug("1001")}
                >
                  Thuốc chính hãng
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => lookupDrug("9999")}
                >
                  Thuốc cảnh báo
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Kết quả xác minh
            </CardTitle>
            <CardDescription>
              Thông tin chi tiết về nguồn gốc và tính xác thực
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2">Đang xác minh...</span>
              </div>
            ) : drugData ? (
              <div className="space-y-6">
                {/* Status Banner */}
                <div className="p-4 rounded-lg border-2 bg-green-100 text-green-800 border-green-200">
                  <div className="flex items-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <div className="ml-3">
                      <h3 className="font-semibold">Thuốc chính hãng ✓</h3>
                      <p className="text-sm mt-1">
                        Lô thuốc đã được xác thực trên blockchain.
                      </p>
                    </div>
                  </div>
                </div>
                {/* Drug Info */}
                <div>
                  <div className="font-mono text-xs text-gray-500 mb-1">
                    ID: {drugData.id}
                  </div>
                  <div className="font-bold text-lg mb-1">{drugData.name}</div>
                  <div className="text-sm text-gray-700 mb-1">
                    Số lô: {drugData.batch_number}
                  </div>
                  <div className="text-sm text-gray-700 mb-1">
                    Ngày sản xuất: {drugData.manufacture_date}
                  </div>
                  <div className="text-sm text-gray-700 mb-1">
                    Hạn dùng: {drugData.expiry_date}
                  </div>
                  <div className="text-sm text-gray-700 mb-1">
                    Mô tả: {drugData.description}
                  </div>
                  <div className="text-sm text-gray-700 mb-1">
                    Trạng thái: <b>{drugData.status}</b>
                  </div>
                  <div className="text-sm text-gray-700 mb-1">
                    Manufacturer:{" "}
                    <span className="font-mono text-xs">
                      {drugData.manufacturer_address}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700 mb-1">
                    Distributor:{" "}
                    <span className="font-mono text-xs">
                      {drugData.distributor_address}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700 mb-1">
                    Pharmacy:{" "}
                    <span className="font-mono text-xs">
                      {drugData.pharmacy_address}
                    </span>
                  </div>
                  {drugData.image_url && (
                    <img
                      src={drugData.image_url}
                      alt="Ảnh thuốc"
                      className="max-w-xs rounded my-2"
                    />
                  )}
                </div>
                {/* Lịch sử vận chuyển */}
                <div className="mt-6">
                  <h4 className="font-semibold mb-2">Lịch sử vận chuyển</h4>
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
                            <th className="px-2 py-1 border">
                              Người thực hiện
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {milestones.map((m: any) => (
                            <tr key={m.id}>
                              <td className="border px-2 py-1">
                                {new Date(m.timestamp).toLocaleString()}
                              </td>
                              <td className="border px-2 py-1">{m.type}</td>
                              <td className="border px-2 py-1">
                                {m.description}
                              </td>
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
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <QrCode className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Quét mã để bắt đầu</h3>
                <p className="text-sm">
                  Quét QR trên hộp thuốc hoặc nhập Token ID để xác minh nguồn
                  gốc
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Section */}
      <div className="mt-12 grid md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="w-12 h-12 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Xác minh Blockchain</h3>
              <p className="text-sm text-gray-600">
                Mỗi lô thuốc được ghi nhận trên blockchain, đảm bảo tính minh
                bạch và không thể giả mạo
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <MapPin className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Theo dõi hành trình</h3>
              <p className="text-sm text-gray-600">
                Xem đầy đủ hành trình từ sản xuất đến người tiêu dùng với dữ
                liệu cảm biến AIoT
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-purple-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Miễn phí sử dụng</h3>
              <p className="text-sm text-gray-600">
                Không cần tạo tài khoản hay kết nối ví. Tra cứu ngay lập tức và
                hoàn toàn miễn phí
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
