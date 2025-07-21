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
import { QrCode, Search, Package } from "lucide-react";
import QRScanner from "@/components/QRScanner";
import RoleGuard from "@/components/RoleGuard";
import { useWallet } from "@/hooks/useWallet";

function PharmacyContent() {
  const [scanMode, setScanMode] = useState<"qr" | "manual">("qr");
  const [nftId, setNftId] = useState("");
  const [drugData, setDrugData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [milestones, setMilestones] = useState<any[]>([]);

  const { account } = useWallet();

  const handleQRScan = (result: string) => {
    setNftId(result);
    lookupDrug(result);
  };

  const lookupDrug = async (id: string) => {
    setIsLoading(true);
    try {
      // Lấy thông tin NFT theo id
      const nftRes = await fetch(
        `/api/manufacturer?nft_id=${encodeURIComponent(id)}`
      );
      const nftData = await nftRes.json();
      if (!nftRes.ok || !nftData || !nftData.id) {
        setDrugData(null);
        setMilestones([]);
        alert("Không tìm thấy lô thuốc với ID này");
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

  const hasConfirmed = milestones.some((m) => m.type === "Đã nhập kho");

  const confirmReceived = async () => {
    if (!drugData || !account) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/manufacturer/milestone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nft_id: drugData.id,
          type: "Đã nhập kho",
          description: "Nhà thuốc xác nhận đã nhận lô thuốc",
          actor_address: account,
          timestamp: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("Đã xác nhận nhập kho!");
        // Reload milestones
        const msRes = await fetch(
          `/api/manufacturer/milestone?nft_id=${drugData.id}`
        );
        const msData = await msRes.json();
        setMilestones(msData || []);
      } else {
        alert(data.error || "Xác nhận thất bại");
      }
    } catch (e) {
      alert("Có lỗi khi xác nhận nhập kho");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Kiểm tra và xác nhận lô thuốc
        </h1>
        <p className="text-gray-600">
          Quét QR hoặc nhập mã để xác minh và nhập kho
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Scanner Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <QrCode className="w-5 h-5 mr-2" />
              Quét mã QR hoặc nhập thủ công
            </CardTitle>
            <CardDescription>
              Sử dụng camera để quét QR trên hộp thuốc hoặc nhập Token ID
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
                Nhập thủ công
              </Button>
            </div>

            {scanMode === "qr" ? (
              <QRScanner onScan={handleQRScan} />
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="nftId">ID lô thuốc</Label>
                  <Input
                    id="nftId"
                    value={nftId}
                    onChange={(e) => setNftId(e.target.value)}
                    placeholder="Nhập ID lô thuốc (ví dụ: 1, 2, 3)"
                  />
                </div>
                <Button
                  onClick={() => lookupDrug(nftId)}
                  disabled={!nftId || isLoading}
                  className="w-full"
                >
                  {isLoading ? "Đang tra cứu..." : "Tra cứu"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Drug Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="w-5 h-5 mr-2" />
              Thông tin lô thuốc
            </CardTitle>
            <CardDescription>Chi tiết về lô thuốc được quét</CardDescription>
          </CardHeader>
          <CardContent>
            {!drugData ? (
              <div className="text-center py-8 text-gray-500">
                <QrCode className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Quét QR hoặc nhập Token ID để xem thông tin</p>
              </div>
            ) : (
              <div>
                <div className="mb-4">
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
                {/* Nút xác nhận nhập kho */}
                {account && !hasConfirmed && (
                  <Button
                    onClick={confirmReceived}
                    disabled={isLoading}
                    className="mb-4"
                  >
                    {isLoading ? "Đang xác nhận..." : "Xác nhận nhập kho"}
                  </Button>
                )}
                {hasConfirmed && (
                  <div className="mb-4 text-green-600 font-semibold">
                    Đã xác nhận nhập kho
                  </div>
                )}
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PharmacyPage() {
  return (
    <RoleGuard requiredRoles={["PHARMACY"]}>
      <PharmacyContent />
    </RoleGuard>
  );
}
