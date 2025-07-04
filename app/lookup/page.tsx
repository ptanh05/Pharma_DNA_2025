"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { QrCode, Search, Shield, AlertTriangle, CheckCircle, MapPin, Calendar } from "lucide-react"
import QRScanner from "@/components/QRScanner"
import Image from "next/image"

// Mock drug data for public lookup
const mockPublicData: Record<string, any> = {}

export default function LookupPage() {
  const [scanMode, setScanMode] = useState<"qr" | "manual">("qr")
  const [tokenId, setTokenId] = useState("")
  const [drugData, setDrugData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleQRScan = (result: string) => {
    setTokenId(result)
    lookupDrug(result)
  }

  const lookupDrug = async (id: string) => {
    setIsLoading(true)
    try {
      // TODO: Implement real public API call to lookup drug
      // const data = await publicLookupDrug(id)
      // setDrugData(data)

      console.log("TODO: Implement public drug lookup API")
      setDrugData({
        tokenId: id,
        status: "not_found",
        warning: "Chức năng tra cứu chưa được tích hợp với blockchain.",
      })
    } catch (error) {
      alert("Có lỗi xảy ra khi tra cứu")
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "authentic":
        return <CheckCircle className="w-6 h-6 text-green-600" />
      case "warning":
      case "not_found":
        return <AlertTriangle className="w-6 h-6 text-red-600" />
      default:
        return <Shield className="w-6 h-6 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "authentic":
        return "bg-green-100 text-green-800 border-green-200"
      case "warning":
      case "not_found":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Tra cứu nguồn gốc thuốc</h1>
        <p className="text-gray-600">Xác minh tính xác thực và nguồn gốc của thuốc chỉ với một lần quét</p>
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
            <CardDescription>Sử dụng camera để quét QR hoặc nhập Token ID thủ công</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 mb-4">
              <Button variant={scanMode === "qr" ? "default" : "outline"} onClick={() => setScanMode("qr")} size="sm">
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
                  <Label htmlFor="tokenId">Token ID hoặc Batch Number</Label>
                  <Input
                    id="tokenId"
                    value={tokenId}
                    onChange={(e) => setTokenId(e.target.value)}
                    placeholder="Nhập mã trên hộp thuốc"
                  />
                </div>
                <Button onClick={() => lookupDrug(tokenId)} disabled={!tokenId || isLoading} className="w-full">
                  {isLoading ? "Đang tra cứu..." : "Tra cứu ngay"}
                </Button>
              </div>
            )}

            {/* Demo buttons */}
            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 mb-2">Thử nghiệm:</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => lookupDrug("1001")}>
                  Thuốc chính hãng
                </Button>
                <Button variant="outline" size="sm" onClick={() => lookupDrug("9999")}>
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
            <CardDescription>Thông tin chi tiết về nguồn gốc và tính xác thực</CardDescription>
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
                <div className={`p-4 rounded-lg border-2 ${getStatusColor(drugData.status)}`}>
                  <div className="flex items-center">
                    {getStatusIcon(drugData.status)}
                    <div className="ml-3">
                      <h3 className="font-semibold">
                        {drugData.status === "authentic" && "Thuốc chính hãng ✓"}
                        {drugData.status === "warning" && "Cảnh báo ⚠"}
                        {drugData.status === "not_found" && "Không tìm thấy ❌"}
                      </h3>
                      {drugData.warning && <p className="text-sm mt-1">{drugData.warning}</p>}
                    </div>
                  </div>
                </div>

                {drugData.status === "authentic" && (
                  <>
                    {/* Drug Image and Basic Info */}
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-shrink-0">
                        <Image
                          src={drugData.image || "/placeholder.svg"}
                          alt={drugData.drugName}
                          width={150}
                          height={150}
                          className="rounded-lg border"
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <h2 className="text-xl font-bold">{drugData.drugName}</h2>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">Số lô:</span>
                            <p className="font-medium">{drugData.batchNumber}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Token ID:</span>
                            <p className="font-medium">#{drugData.tokenId}</p>
                          </div>
                        </div>
                        <div className="flex items-center text-sm">
                          <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                          <span className="text-gray-600">HSD: </span>
                          <span className="font-medium ml-1">{drugData.expiryDate}</span>
                        </div>
                        <p className="text-sm text-gray-600">{drugData.description}</p>
                      </div>
                    </div>

                    {/* Manufacturer */}
                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-2">Nhà sản xuất</h4>
                      <p className="text-gray-700">{drugData.manufacturer}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {drugData.certificates.map((cert: string, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {cert}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Journey */}
                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-3">Hành trình chuỗi cung ứng</h4>
                      <div className="space-y-3">
                        {drugData.journey.map((step: any, index: number) => (
                          <div key={index} className="flex items-start">
                            <div className="flex-shrink-0 mt-1">
                              {step.verified ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
                              )}
                            </div>
                            <div className="ml-3 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{step.step}</span>
                                <span className="text-xs text-gray-500">{step.date}</span>
                              </div>
                              <div className="flex items-center text-xs text-gray-600 mt-1">
                                <MapPin className="w-3 h-3 mr-1" />
                                {step.location}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Action Buttons */}
                <div className="border-t pt-4 space-y-2">
                  <Button variant="outline" className="w-full bg-transparent" size="sm">
                    Chia sẻ kết quả
                  </Button>
                  <Button variant="outline" className="w-full bg-transparent" size="sm">
                    Báo cáo vấn đề Báo cáo vấn đề
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <QrCode className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Quét mã để bắt đầu</h3>
                <p className="text-sm">Quét QR trên hộp thuốc hoặc nhập Token ID để xác minh nguồn gốc</p>
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
                Mỗi lô thuốc được ghi nhận trên blockchain, đảm bảo tính minh bạch và không thể giả mạo
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
                Xem đầy đủ hành trình từ sản xuất đến người tiêu dùng với dữ liệu cảm biến AIoT
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
                Không cần tạo tài khoản hay kết nối ví. Tra cứu ngay lập tức và hoàn toàn miễn phí
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
