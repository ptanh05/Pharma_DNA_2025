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

function PharmacyContent() {
  const [scanMode, setScanMode] = useState<"qr" | "manual">("qr");
  const [tokenId, setTokenId] = useState("");
  const [drugData, setDrugData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleQRScan = (result: string) => {
    setTokenId(result);
    lookupDrug(result);
  };

  const lookupDrug = async (id: string) => {
    setIsLoading(true);
    try {
      console.log("TODO: Implement drug lookup API");
      alert("Chức năng tra cứu thuốc chưa được tích hợp");
      setDrugData(null);
    } catch (error) {
      alert("Có lỗi xảy ra khi tra cứu");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmReceived = async () => {
    if (!drugData) return;

    setIsLoading(true);
    try {
      console.log("TODO: Implement pharmacy confirmation API");
      alert("Chức năng xác nhận nhập kho chưa được tích hợp");
    } catch (error) {
      alert("Có lỗi xảy ra");
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
                  <Label htmlFor="tokenId">Token ID</Label>
                  <Input
                    id="tokenId"
                    value={tokenId}
                    onChange={(e) => setTokenId(e.target.value)}
                    placeholder="Nhập Token ID (ví dụ: 1001)"
                  />
                </div>
                <Button
                  onClick={() => lookupDrug(tokenId)}
                  disabled={!tokenId || isLoading}
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
            <div className="text-center py-8 text-gray-500">
              <QrCode className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Quét QR hoặc nhập Token ID để xem thông tin</p>
            </div>
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
