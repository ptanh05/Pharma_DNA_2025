"use client";

import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
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
import { QrCode, Search, Package, Truck, Warehouse } from "lucide-react";
import QRScanner from "@/components/QRScanner";
import RoleGuard from "@/components/RoleGuard";
import { useWalletSui as useWallet } from "@/hooks/useWalletSui";
import PharmacyTransferRequests from "@/components/PharmacyTransferRequests";
import AIAgentPanel from "@/components/AIAgentPanel";
import ErrorBoundary from "@/components/ErrorBoundary";
import { parseError } from "@/lib/utils/error-handler";

function PharmacyContent() {
  const [scanMode, setScanMode] = useState<"qr" | "manual">("qr");
  const [batchNumber, setBatchNumber] = useState("");
  const [drugData, setDrugData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [showTransferRequests, setShowTransferRequests] = useState(false);
  const [transferRequests, setTransferRequests] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [inventory, setInventory] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedBatchQR, setSelectedBatchQR] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { account } = useWallet();

  // Fetch inventory
  useEffect(() => {
    if (!account) return;
    const fetchInventory = async () => {
      setInventoryLoading(true);
      try {
        const res = await fetch(`/api/pharmacy/inventory?address=${account}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            // API trả về { inventory: [...], total, page, limit }
            setInventory(data.data.inventory || data.data || []);
          }
        }
      } catch (e) {
        console.error("Error fetching inventory:", e);
      } finally {
        setInventoryLoading(false);
      }
    };
    fetchInventory();
  }, [account, refreshKey]);

  // Fetch pending transfer requests count
  useEffect(() => {
    if (!account) return;
    const fetchPendingCount = async () => {
      try {
        const res = await fetch(`/api/distributor/transfer-to-pharmacy?pharmacy_address=${account}&status=pending`);
        if (res.ok) {
          const data = await res.json();
          const requests = data.data || data;
          setPendingCount(Array.isArray(requests) ? requests.length : 0);
        }
      } catch (e) {
        console.error("Error fetching pending count:", e);
      }
    };
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [account]);

  const handleQRScan = (result: string) => {
    setBatchNumber(result);
    lookupDrug(result);
  };

  const lookupDrug = async (batch_number: string) => {
    setIsLoading(true);
    try {
      // Lấy thông tin NFT theo batch_number
      const nftRes = await fetch(
        `/api/manufacturer?batch_number=${encodeURIComponent(batch_number)}`
      );
      const nftData = await nftRes.json();
      if (!nftRes.ok || !nftData || !nftData.batch_number) {
        setDrugData(null);
        setMilestones([]);
        alert("Không tìm thấy lô thuốc với số lô này");
        setIsLoading(false);
        return;
      }
      setDrugData(nftData);
      // Lấy lịch sử vận chuyển
      const msRes = await fetch(
        `/api/manufacturer/milestone?batch_number=${nftData.batch_number}`
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

  // Generate QR code for a batch
  const generateQRCode = async (item: any) => {
    setSelectedBatchQR(item);
    setShowQRModal(true);
    try {
      // QR chứa URL đầy đủ tới trang tra cứu
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const lookupUrl = `${baseUrl}/lookup?batch=${encodeURIComponent(item.batch_number || item.id)}`;
      const url = await QRCode.toDataURL(lookupUrl, {
        width: 256,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error("QR generation error:", err);
      setQrDataUrl("");
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
          batch_number: drugData.batch_number,
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
          `/api/manufacturer/milestone?batch_number=${drugData.batch_number}`
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
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1 md:mb-2">
              Kiểm tra và xác nhận lô thuốc
            </h1>
            <p className="text-sm md:text-base text-gray-600">
              Quét QR hoặc nhập số lô để xác minh và nhập kho
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowTransferRequests(!showTransferRequests)}
            className="flex items-center relative w-full sm:w-auto"
          >
            <Truck className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Yêu cầu chuyển lô</span>
            <span className="sm:hidden">YC Chuyển lô</span>
            {pendingCount > 0 && (
              <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {pendingCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 md:gap-6 lg:gap-8">
        {/* Scanner Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <QrCode className="w-5 h-5 mr-2" />
              Quét mã QR hoặc nhập thủ công
            </CardTitle>
            <CardDescription>
              Sử dụng camera để quét QR trên hộp thuốc hoặc nhập Số lô
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
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
                  <Label htmlFor="batchNumber">Số lô thuốc</Label>
                  <Input
                    id="batchNumber"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    placeholder="Nhập số lô thuốc (ví dụ: BN123, BN456)"
                  />
                </div>
                <Button
                  onClick={() => lookupDrug(batchNumber)}
                  disabled={!batchNumber || isLoading}
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
                <p>Quét QR hoặc nhập Số lô để xem thông tin</p>
              </div>
            ) : (
              <div>
                <div className="mb-4">
                  <div className="font-mono text-xs text-gray-500 mb-1">
                    Số lô: {drugData.batch_number}
                  </div>
                  <div className="font-bold text-lg mb-1">{drugData.name}</div>
                  <div className="text-sm text-gray-700 mb-1">
                    ID: {drugData.id}
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
                      className="max-w-xs w-full rounded my-2"
                      loading="lazy"
                      decoding="async"
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

      {/* Kho - Danh sách thuốc trong kho */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Warehouse className="w-5 h-5 mr-2" />
              Kho thuốc
            </CardTitle>
            <CardDescription>
              Danh sách thuốc đang có trong kho ({inventory.length} lô)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inventoryLoading ? (
              <div className="text-center py-8 text-gray-500">Đang tải...</div>
            ) : inventory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Warehouse className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Chưa có thuốc trong kho</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border px-3 py-2 text-left">Số lô</th>
                        <th className="border px-3 py-2 text-left">Tên thuốc</th>
                        <th className="border px-3 py-2 text-left">Số lượng</th>
                        <th className="border px-3 py-2 text-left">Trạng thái</th>
                        <th className="border px-3 py-2 text-left">Ngày nhập</th>
                        <th className="border px-3 py-2 text-left">QR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.slice(0, 10).map((item: any) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="border px-3 py-2 font-mono text-xs">{item.batch_number}</td>
                          <td className="border px-3 py-2">{item.name}</td>
                          <td className="border px-3 py-2">{item.quantity || 1}</td>
                          <td className="border px-3 py-2">
                            <Badge variant={item.status === 'available' ? 'default' : 'secondary'}>
                              {item.status === 'available' ? 'Còn hàng' : item.status}
                            </Badge>
                          </td>
                          <td className="border px-3 py-2">
                            {item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : '-'}
                          </td>
                          <td className="border px-3 py-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => generateQRCode(item)}
                            >
                              QR
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile cards */}
                <div className="md:hidden grid grid-cols-1 gap-3">
                  {inventory.slice(0, 10).map((item: any) => (
                    <div key={item.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-bold text-sm">{item.name}</div>
                          <div className="text-xs text-gray-500 font-mono">{item.batch_number}</div>
                        </div>
                        <Badge variant={item.status === 'available' ? 'default' : 'secondary'} className="text-xs">
                          {item.status === 'available' ? 'Còn hàng' : item.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <div className="text-xs text-gray-600">
                          SL: {item.quantity || 1} | {item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : '-'}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateQRCode(item)}
                        >
                          QR
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {inventory.length > 10 && (
                  <div className="text-center py-2 text-sm text-gray-500">
                    Hiển thị 10/{inventory.length} lô
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Yêu cầu chuyển lô từ nhà phân phối */}
      {showTransferRequests && (
        <div className="mt-8">
          <PharmacyTransferRequests
            pharmacyAddress={account || ""}
            onApproved={() => setRefreshKey(k => k + 1)}
          />
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && selectedBatchQR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <div className="text-center">
              <h3 className="text-lg font-bold mb-2">Mã QR - Lô thuốc</h3>
              <p className="text-sm text-gray-600 mb-4">{selectedBatchQR.batch_number}</p>
              <p className="text-xs text-gray-500 mb-4">{selectedBatchQR.name}</p>
              {qrDataUrl ? (
                <>
                  <img src={qrDataUrl} alt="QR Code" className="mx-auto mb-4" />
                  <p className="text-xs text-gray-500 mb-2">
                    Quét mã QR để xem thông tin thuốc trên trang tra cứu
                  </p>
                  <p className="text-xs text-gray-400 mb-4">
                    URL: /lookup?batch={selectedBatchQR.batch_number}
                  </p>
                </>
              ) : (
                <div className="flex items-center justify-center h-64 mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              )}
              <div className="flex gap-2">
                {qrDataUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const link = document.createElement("a");
                      link.download = `qr-${selectedBatchQR.batch_number}.png`;
                      link.href = qrDataUrl;
                      link.click();
                    }}
                  >
                    Tải QR
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQRModal(false)}
                >
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Agent Panel */}
      <div className="mt-8">
        <AIAgentPanel 
          role="pharmacy" 
          context={{ account, transferRequests }}
        />
      </div>
    </div>
  );
}

export default function PharmacyPage() {
  return (
    <ErrorBoundary>
      <RoleGuard requiredRoles={["PHARMACY"]}>
        <PharmacyContent />
      </RoleGuard>
    </ErrorBoundary>
  );
}
