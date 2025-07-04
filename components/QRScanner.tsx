"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Camera, Upload } from "lucide-react"

interface QRScannerProps {
  onScan: (result: string) => void
}

export default function QRScanner({ onScan }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const startScanning = async () => {
    setIsScanning(true)
    setError("")

    try {
      // TODO: Implement real camera access and QR scanning
      // const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      // const result = await scanQRFromStream(stream)
      // onScan(result)

      console.log("TODO: Implement real QR scanning")
      setError("Chức năng quét QR chưa được tích hợp")
      setIsScanning(false)
    } catch (err) {
      setError("Không thể truy cập camera. Vui lòng thử lại.")
      setIsScanning(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // TODO: Implement real QR code reading from image
      // const result = await readQRFromImage(file)
      // onScan(result)

      console.log("TODO: Implement QR reading from image")
      alert("Chức năng đọc QR từ ảnh chưa được tích hợp")
    }
  }

  return (
    <div className="space-y-4">
      {/* Camera Scanner */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        {isScanning ? (
          <div className="space-y-4">
            <div className="animate-pulse">
              <div className="w-48 h-48 bg-gray-200 rounded-lg mx-auto mb-4"></div>
            </div>
            <p className="text-sm text-gray-600">Đang quét QR code...</p>
            <Button variant="outline" onClick={() => setIsScanning(false)}>
              Dừng quét
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Camera className="w-16 h-16 text-gray-400 mx-auto" />
            <div>
              <h3 className="font-medium mb-2">Quét QR bằng camera</h3>
              <p className="text-sm text-gray-600 mb-4">Nhấn nút bên dưới để bật camera và quét QR code</p>
              <Button onClick={startScanning}>
                <Camera className="w-4 h-4 mr-2" />
                Bật camera
              </Button>
            </div>
          </div>
        )}
      </div>

      {error && <div className="text-red-600 text-sm text-center">{error}</div>}

      {/* File Upload Alternative */}
      <div className="text-center">
        <p className="text-sm text-gray-600 mb-2">Hoặc</p>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-4 h-4 mr-2" />
          Tải ảnh QR lên
        </Button>
      </div>

      <div className="text-xs text-gray-500 text-center">
        <p>💡 Mẹo: Đảm bảo QR code rõ nét và đủ ánh sáng</p>
      </div>
    </div>
  )
}
