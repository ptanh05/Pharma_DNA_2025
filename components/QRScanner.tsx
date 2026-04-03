"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Camera, Upload, X, Loader2, CheckCircle } from "lucide-react"
import { toast } from "sonner"

// Static import jsqr once (client-only)
let jsqrLib: ((data: Uint8ClampedArray, width: number, height: number) => { data: string } | null) | null = null

interface QRScannerProps {
  onScan: (result: string) => void
}

export default function QRScanner({ onScan }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState("")
  const [scanLoading, setScanLoading] = useState(false)
  const [cameraError, setCameraError] = useState("")
  const [scanSuccess, setScanSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)
  const isScanningRef = useRef(false)

  // Cleanup camera stream
  const stopCamera = useCallback(() => {
    isScanningRef.current = false
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

  // Decode QR from canvas frame
  const decodeQR = useCallback((video: HTMLVideoElement): string | null => {
    const canvas = canvasRef.current
    if (!canvas || !video || !jsqrLib) return null
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return null

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsqrLib(imageData.data, imageData.width, imageData.height)
    return code ? code.data : null
  }, [])

  // Start camera scanning loop
  const startScanning = async () => {
    setError("")
    setCameraError("")
    setScanSuccess(false)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream

      if (!videoRef.current) return
      videoRef.current.srcObject = stream
      await videoRef.current.play()

      isScanningRef.current = true
      setIsScanning(true)

      // Load jsqr lazily once
      if (!jsqrLib) {
        const mod = await import("jsqr")
        jsqrLib = mod.default
      }

      // Scanning loop using ref (no stale closure)
      const scan = () => {
        if (!isScanningRef.current || !videoRef.current) return
        const result = decodeQR(videoRef.current)
        if (result) {
          setScanSuccess(true)
          setTimeout(() => {
            stopCamera()
            onScan(result)
          }, 800) // Brief success animation
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
      isScanningRef.current = false
      setIsScanning(false)
    }
  }

  // Read QR from uploaded image
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setScanLoading(true)
    setError("")
    setScanSuccess(false)

    try {
      if (!jsqrLib) {
        const mod = await import("jsqr")
        jsqrLib = mod.default
      }

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
      const code = jsqrLib(imageData.data, imageData.width, imageData.height)

      URL.revokeObjectURL(objectUrl)

      if (code) {
        setScanSuccess(true)
        toast.success("Đã quét thành công!")
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
      <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 sm:p-6 text-center bg-gray-50/50">
        {isScanning ? (
          <div className="space-y-4">
            {/* Instructions banner */}
            <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs sm:text-sm text-blue-700 flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              Đưa QR code vào khung hình và giữ yên
            </div>

            <div className="relative w-full max-w-[280px] sm:max-w-[320px] mx-auto aspect-square bg-black rounded-xl overflow-hidden shadow-xl">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {/* Scanning overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  className={`w-3/4 h-3/4 border-2 rounded-2xl transition-colors duration-300 ${
                    scanSuccess ? "border-green-500" : "border-white/60"
                  }`}
                />
                {/* Corner markers */}
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 pointer-events-none ${
                  scanSuccess ? "" : "animate-pulse"
                }`}>
                  <div className={`absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 rounded-tl-xl ${scanSuccess ? "border-green-500" : "border-blue-400"}`} />
                  <div className={`absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 rounded-tr-xl ${scanSuccess ? "border-green-500" : "border-blue-400"}`} />
                  <div className={`absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 rounded-bl-xl ${scanSuccess ? "border-green-500" : "border-blue-400"}`} />
                  <div className={`absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 rounded-br-xl ${scanSuccess ? "border-green-500" : "border-blue-400"}`} />
                </div>
                {scanSuccess ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                    <CheckCircle className="w-16 h-16 sm:w-20 sm:h-20 text-green-500 animate-bounce-in" />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex justify-center overflow-hidden">
                    <div className="w-[75%] flex justify-center overflow-hidden rounded-xl">
                      <div className="w-0.5 bg-gradient-to-b from-blue-400 via-transparent to-blue-400 scan-line" />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <p className={`text-sm sm:text-base font-medium ${scanSuccess ? "text-green-600" : "text-gray-600"}`}>
              {scanSuccess ? "Đã quét thành công!" : "Đang quét mã QR..."}
            </p>
            <Button variant="outline" onClick={stopCamera} disabled={scanSuccess} size="sm" className="min-h-[44px]">
              <X className="w-4 h-4 mr-2" />
              Dừng quét
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full bg-blue-100 flex items-center justify-center">
              <Camera className="w-7 h-7 sm:w-8 sm:h-8 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-1.5">Quét QR bằng camera</h3>
              <p className="text-sm text-gray-600 mb-4">Bật camera để quét mã QR trên hộp thuốc</p>
              <Button onClick={startScanning} size="lg" className="min-h-[48px] px-6">
                <Camera className="w-5 h-5 mr-2" />
                Bật camera
              </Button>
            </div>
          </div>
        )}
      </div>

      {displayError && (
        <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-3 sm:p-4">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-red-600 text-sm">!</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-red-800 font-medium text-xs sm:text-sm">{displayError}</p>
              <p className="text-red-600 text-xs mt-1">Vui lòng kiểm tra quyền truy cập camera trong cài đặt trình duyệt</p>
            </div>
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 font-medium">HOẶC</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* File Upload Alternative */}
      <div className="text-center">
        <p className="text-xs sm:text-sm text-gray-500 mb-2">Tải ảnh QR từ thư viện</p>
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
          size="lg"
          className="min-h-[48px] w-full sm:w-auto px-6"
        >
          {scanLoading ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <Upload className="w-5 h-5 mr-2" />
          )}
          Tải ảnh QR lên
        </Button>
      </div>

      {/* Tips */}
      <div className="bg-blue-50/50 rounded-xl p-3 sm:p-4 space-y-1.5 sm:space-y-2">
        <p className="text-xs sm:text-sm font-semibold text-blue-700 mb-2">Mẹo quét QR:</p>
        <div className="flex items-start gap-2 text-xs sm:text-sm text-blue-700">
          <span className="text-blue-400 mt-0.5">&#x2022;</span>
          <span>Đảm bảo đủ ánh sáng và QR code rõ nét</span>
        </div>
        <div className="flex items-start gap-2 text-xs sm:text-sm text-blue-700">
          <span className="text-blue-400 mt-0.5">&#x2022;</span>
          <span>Giữ camera ổn định trong quá trình quét</span>
        </div>
        <div className="flex items-start gap-2 text-xs sm:text-sm text-blue-700">
          <span className="text-blue-400 mt-0.5">&#x2022;</span>
          <span>Đưa QR code nằm trọn trong khung hình</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes scan-line {
          0% { transform: translateY(-160px); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(160px); opacity: 0; }
        }
        .scan-line {
          animation: scan-line 2s ease-in-out infinite;
        }
        @keyframes bounce-in {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-bounce-in {
          animation: bounce-in 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
