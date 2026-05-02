"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  ExternalLink,
  Link2,
  Package,
} from "lucide-react";
import QRScanner from "@/components/QRScanner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { toast } from "sonner";
import { parseError } from "@/lib/utils/error-handler";
import { getSuiExplorerObjectUrl, getSuiExplorerTxUrl } from "@/lib/blockchain/config-sui";

// Mock drug data for public lookup
const mockPublicData: Record<string, any> = {};

function LookupContent() {
  const [scanMode, setScanMode] = useState<"qr" | "manual">("qr");
  const [tokenId, setTokenId] = useState("");
  const [batchName, setBatchName] = useState("");
  const [drugData, setDrugData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [milestones, setMilestones] = useState<any[]>([]);

  // Auto-lookup when URL has ?batch= parameter (from QR scan)
  const searchParams = useSearchParams();
  useEffect(() => {
    const batchParam = searchParams.get("batch");
    if (batchParam) {
      setTokenId(batchParam);
      lookupDrug(batchParam);
    }
  }, [searchParams]);

  const handleQRScan = (result: string) => {
    // Nếu quét được URL (từ QR in pharmacy), trích xuất batch parameter
    if (result.includes("/lookup?batch=")) {
      try {
        const url = new URL(result);
        const batchParam = url.searchParams.get("batch");
        if (batchParam) {
          setTokenId(batchParam);
          lookupDrug(batchParam);
          return;
        }
      } catch (e) {
        // fallback
      }
    }
    setTokenId(result);
    lookupDrug(result);
  };

  const lookupDrug = async (name: string) => {
    setIsLoading(true);
    try {
      const nftRes = await fetch(
        `/api/public/lookup?batch=${encodeURIComponent(name)}`
      );
      const nftData = await nftRes.json();
      if (!nftRes.ok || !nftData || !nftData.success || !nftData.data) {
        setDrugData(null);
        setMilestones([]);
        toast.error("Không tìm thấy lô thuốc", {
          description: "Không tìm thấy lô thuốc với tên này. Vui lòng kiểm tra lại.",
        });
        setIsLoading(false);
        return;
      }
      setDrugData(nftData.data);
      // Lấy lịch sử vận chuyển
      const msRes = await fetch(
        `/api/manufacturer/milestone?nft_id=${nftData.data.id}`
      );
      const msData = await msRes.json();
      setMilestones(msData || []);
    } catch (error) {
      const errorDetails = parseError(error);
      toast.error("Lỗi tra cứu", {
        description: errorDetails.message || "Đã xảy ra lỗi không mong muốn",
      });
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
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <div className="mb-6 md:mb-8 text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          Tra cứu nguồn gốc thuốc
        </h1>
        <p className="text-sm md:text-base text-gray-600">
          Xác minh tính xác thực và nguồn gốc của thuốc chỉ với một lần quét
        </p>
        <div className="mt-4 p-3 md:p-4 bg-blue-50 rounded-lg inline-block">
          <p className="text-xs md:text-sm text-blue-800">
            <Shield className="w-4 h-4 inline mr-1" />
            Dịch vụ miễn phí - Không cần kết nối ví
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 md:gap-6 lg:gap-8">
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
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <Button
                variant={scanMode === "qr" ? "default" : "outline"}
                onClick={() => setScanMode("qr")}
                size="sm"
                className="w-full sm:w-auto"
              >
                <QrCode className="w-4 h-4 mr-1" />
                Quét QR
              </Button>
              <Button
                variant={scanMode === "manual" ? "default" : "outline"}
                onClick={() => setScanMode("manual")}
                size="sm"
                className="w-full sm:w-auto"
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
            <div className="border-t pt-3 md:pt-4">
              <p className="text-xs md:text-sm text-gray-600 mb-2">Thử nghiệm:</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => lookupDrug("1001")}
                  className="w-full sm:w-auto"
                >
                  Thuốc chính hãng
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => lookupDrug("9999")}
                  className="w-full sm:w-auto"
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
              <div className="flex items-center justify-center py-8 md:py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2">Đang xác minh...</span>
              </div>
            ) : drugData ? (
              <div className="space-y-4 md:space-y-6">
                {/* Status Banner */}
                <div className="p-3 md:p-4 rounded-lg border-2 bg-green-100 text-green-800 border-green-200">
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                    <div className="ml-2 md:ml-3">
                      <h3 className="font-semibold text-sm md:text-base">Thuốc chính hãng ✓</h3>
                      <p className="text-xs md:text-sm mt-1">
                        Lô thuốc đã được xác thực trên blockchain.
                      </p>
                    </div>
                  </div>
                </div>
                {/* Drug Info */}
                <div className="text-xs md:text-sm space-y-1">
                  <div className="font-mono text-gray-500">
                    ID: {drugData.id}
                  </div>
                  <div className="font-bold text-base md:text-lg">{drugData.name}</div>
                  <div className="text-gray-700">
                    Số lô: {drugData.batch_number}
                  </div>
                  <div className="text-gray-700">
                    Ngày SX: {drugData.manufacture_date} | Hạn: {drugData.expiry_date}
                  </div>
                  <div className="text-gray-700">
                    Mô tả: {drugData.description}
                  </div>
                  <div className="text-gray-700">
                    Trạng thái: <b>{drugData.status}</b>
                  </div>
                  <div className="text-gray-700 break-all">
                    MFG: <span className="font-mono text-xs">{drugData.manufacturer_address}</span>
                  </div>
                  <div className="text-gray-700 break-all">
                    DIST: <span className="font-mono text-xs">{drugData.distributor_address}</span>
                  </div>
                  {drugData.pharmacy_address && (
                    <div className="text-gray-700 break-all">
                      PHAR: <span className="font-mono text-xs">{drugData.pharmacy_address}</span>
                    </div>
                  )}
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

                {/* Blockchain Info */}
                {(drugData as any).object_id || (drugData as any).transaction_digest || (drugData as any).transaction_hash || (drugData as any).ipfs_hash ? (
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                      <Link2 className="w-4 h-4" />
                      Thông tin Blockchain
                    </h4>
                    <div className="space-y-2 text-xs">
                      {(drugData as any).object_id && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Object ID:</span>
                          <button
                            onClick={() => window.open(getSuiExplorerObjectUrl((drugData as any).object_id), "_blank")}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-mono"
                          >
                            {(drugData as any).object_id}
                            <ExternalLink className="w-3 h-3 inline ml-1" />
                          </button>
                        </div>
                      )}
                      {((drugData as any).transaction_digest || (drugData as any).transaction_hash) && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">TX Hash:</span>
                          <button
                            onClick={() => window.open(getSuiExplorerTxUrl((drugData as any).transaction_digest || (drugData as any).transaction_hash || ''), "_blank")}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-mono"
                          >
                            {((drugData as any).transaction_digest || (drugData as any).transaction_hash)}
                            <ExternalLink className="w-3 h-3 inline ml-1" />
                          </button>
                        </div>
                      )}
                      {(drugData as any).ipfs_hash && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">IPFS:</span>
                          <button
                            onClick={() => window.open(`https://gateway.pinata.cloud/ipfs/${(drugData as any).ipfs_hash}`, "_blank")}
                            className="text-purple-600 hover:text-purple-800 hover:underline font-mono"
                          >
                            {(drugData as any).ipfs_hash}
                            <ExternalLink className="w-3 h-3 inline ml-1" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(drugData as any).object_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => window.open(getSuiExplorerObjectUrl((drugData as any).object_id), "_blank")}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Xem NFT trên Suivision
                        </Button>
                      )}
                      {((drugData as any).transaction_digest || (drugData as any).transaction_hash) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => window.open(getSuiExplorerTxUrl((drugData as any).transaction_digest || (drugData as any).transaction_hash || ''), "_blank")}
                        >
                          <Link2 className="w-3 h-3 mr-1" />
                          Xem Transaction
                        </Button>
                      )}
                      {(drugData as any).ipfs_hash && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => window.open(`https://gateway.pinata.cloud/ipfs/${(drugData as any).ipfs_hash}`, "_blank")}
                        >
                          <Package className="w-3 h-3 mr-1" />
                          Xem Metadata IPFS
                        </Button>
                      )}
                    </div>
                  </div>
                ) : null}
                {/* Lịch sử vận chuyển */}
                <div className="mt-4 md:mt-6">
                  <h4 className="font-semibold mb-2">Lịch sử vận chuyển</h4>
                  {milestones.length === 0 ? (
                    <div className="text-sm text-gray-500">
                      Chưa có mốc vận chuyển nào
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {milestones.map((m: any) => (
                        <div key={m.id} className="border rounded-lg p-2 md:p-3 text-xs md:text-sm">
                          <div className="flex justify-between items-start mb-1">
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
              </div>
            ) : (
              <div className="text-center py-8 md:py-12 text-gray-500">
                <QrCode className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 opacity-50" />
                <h3 className="text-base md:text-lg font-medium mb-2">Quét mã để bắt đầu</h3>
                <p className="text-xs md:text-sm">
                  Quét QR trên hộp thuốc hoặc nhập mã để xác minh nguồn gốc
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Section */}
      <div className="mt-8 md:mt-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="text-center">
              <Shield className="w-10 h-10 md:w-12 md:h-12 text-blue-600 mx-auto mb-2 md:mb-3" />
              <h3 className="font-semibold text-sm md:text-base mb-1 md:mb-2">Xác minh Blockchain</h3>
              <p className="text-xs md:text-sm text-gray-600">
                Mỗi lô thuốc được ghi nhận trên blockchain, đảm bảo tính minh bạch
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="text-center">
              <MapPin className="w-10 h-10 md:w-12 md:h-12 text-green-600 mx-auto mb-2 md:mb-3" />
              <h3 className="font-semibold text-sm md:text-base mb-1 md:mb-2">Theo dõi hành trình</h3>
              <p className="text-xs md:text-sm text-gray-600">
                Xem đầy đủ hành trình từ sản xuất đến người tiêu dùng
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2 md:col-span-1">
          <CardContent className="pt-4 md:pt-6">
            <div className="text-center">
              <CheckCircle className="w-10 h-10 md:w-12 md:h-12 text-purple-600 mx-auto mb-2 md:mb-3" />
              <h3 className="font-semibold text-sm md:text-base mb-1 md:mb-2">Miễn phí sử dụng</h3>
              <p className="text-xs md:text-sm text-gray-600">
                Không cần tạo tài khoản hay kết nối ví
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LookupPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="p-8 text-center">Đang tải...</div>}>
        <LookupContent />
      </Suspense>
    </ErrorBoundary>
  );
}
