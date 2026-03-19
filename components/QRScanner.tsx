"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Camera, Upload, X, Loader2 } from "lucide-react"

interface QRScannerProps {
  onScan: (result: string) => void
}

export default function QRScanner({ onScan }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState("")
  const [scanLoading, setScanLoading] = useState(false)
  const [cameraError, setCameraError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)

  // Cleanup camera stream
  const stopCamera = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsScanning(false)
  }, [])

  // Decode QR from canvas frame using jsqr
  const decodeQR = useCallback(async (video: HTMLVideoElement): Promise<string | null> => {
    const canvas = canvasRef.current
    if (!canvas || !video) return null
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return null

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // Dynamic import jsqr to avoid SSR issues
    const jsqr = (await import("jsqr")).default
    const code = jsqr(imageData.data, imageData.width, imageData.height)
    return code ? code.data : null
  }, [])

  // Start camera scanning loop
  const startScanning = async () => {
    setError("")
    setCameraError("")

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream

      if (!videoRef.current) return
      videoRef.current.srcObject = stream
      await videoRef.current.play()

      setIsScanning(true)

      // Scanning loop
      const scan = async () => {
        if (!isScanning || !videoRef.current) return
        const result = await decodeQR(videoRef.current)
        if (result) {
          stopCamera()
          onScan(result)
          return
        }
        animationRef.current = requestAnimationFrame(scan)
      }
      animationRef.current = requestAnimationFrame(scan)
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Quyền truy cập camera bị từ chối. Vui lòng cho phép truy cập camera trong cài đặt trình duyệt.")
      } else if (err.name === "NotFoundError") {
        setCameraError("Không tìm thấy camera. Vui lòng kết nối camera và thử lại.")
      } else if (err.name === "NotReadableError") {
        setCameraError("Camera đang được sử dụng bởi ứng dụng khác.")
      } else {
        setCameraError(`Không thể truy cập camera: ${err.message}`)
      }
      setIsScanning(false)
    }
  }

  // Read QR from uploaded image
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setScanLoading(true)
    setError("")

    try {
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("Không thể đọc ảnh"))
        img.src = objectUrl
      })

      const canvas = document.createElement("canvas")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) throw new Error("Không thể tạo canvas context")

      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      const jsqr = (await import("jsqr")).default
      const code = jsqr(imageData.data, imageData.width, imageData.height)

      URL.revokeObjectURL(objectUrl)

      if (code) {
        onScan(code.data)
      } else {
        setError("Không tìm thấy mã QR trong ảnh. Vui lòng thử ảnh khác.")
      }
    } catch (err: any) {
      setError(`Lỗi đọc QR: ${err.message}`)
    } finally {
      setScanLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  const displayError = cameraError || error

  return (
    <div className="space-y-4">
      {/* Hidden canvas for QR decoding */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera Scanner */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
        {isScanning ? (
          <div className="space-y-4">
            <div className="relative w-64 h-64 mx-auto bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {/* Scanning overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-blue-500 rounded-lg animate-pulse" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 flex justify-center">
                  <div className="w-1 h-48 bg-blue-500 animate-scan" />
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600">Đang quét QR code...</p>
            <Button variant="outline" onClick={stopCamera}>
              <X className="w-4 h-4 mr-2" />
              Dừng quét
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Camera className="w-12 h-12 text-gray-400 mx-auto" />
            <div>
              <h3 className="font-medium mb-2">Quét QR bằng camera</h3>
              <p className="text-sm text-gray-600 mb-4">Bật camera để quét mã QR trên hộp thuốc</p>
              <Button onClick={startScanning}>
                <Camera className="w-4 h-4 mr-2" />
                Bật camera
              </Button>
            </div>
          </div>
        )}
      </div>

      {displayError && (
        <div className="text-red-600 text-sm text-center p-2 bg-red-50 rounded-lg">
          {displayError}
        </div>
      )}

      {/* File Upload Alternative */}
      <div className="text-center">
        <p className="text-sm text-gray-500 mb-2">hoặc tải ảnh QR lên</p>
        <input
          ref={fileInputRef}
          id="qr-upload-input"
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
          aria-label="Tải ảnh QR"
          title="Tải ảnh QR lên"
        />
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={scanLoading}
        >
          {scanLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          Tải ảnh QR lên
        </Button>
      </div>

      <div className="text-xs text-gray-500 text-center">
        <p>💡 Đảm bảo QR code rõ nét, đủ ánh sáng và nằm trong khung hình</p>
      </div>

      <style jsx>{`
        @keyframes scan {
          0% { transform: translateY(-96px); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(96px); opacity: 0; }
        }
        .animate-scan {
          animation: scan 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
