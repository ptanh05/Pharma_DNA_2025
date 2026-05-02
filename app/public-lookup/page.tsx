'use client';

import { useState, Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, QrCode, Search, Package, CheckCircle, AlertTriangle, Loader2, Info, ExternalLink, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import QRScanner from '@/components/QRScanner';
import ErrorBoundary from '@/components/ErrorBoundary';
import { toast } from 'sonner';
import { getSuiExplorerObjectUrl, getSuiExplorerTxUrl } from '@/lib/blockchain/config-sui';

interface DrugData {
  id: number;
  name: string;
  batch_number: string;
  status: string;
  manufacturer_address: string;
  distributor_address?: string;
  pharmacy_address?: string;
  manufacture_date: string;
  expiry_date?: string;
  description?: string;
  image_url?: string;
  object_id?: string;
  transaction_digest?: string;
  transaction_hash?: string;
  ipfs_hash?: string;
  token_id?: string;
}

function PublicLookupContent() {
  const [scanMode, setScanMode] = useState<'qr' | 'manual'>('qr');
  const [query, setQuery] = useState('');
  const [drugData, setDrugData] = useState<DrugData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const searchParams = useSearchParams();
  const [autoRan, setAutoRan] = useState(false);

  const lookupDrug = async (name: string) => {
    setIsLoading(true);
    setError('');
    setDrugData(null);
    try {
      const nftRes = await fetch(`/api/public/lookup?batch=${encodeURIComponent(name)}`);
      const nftData = await nftRes.json();
      if (!nftRes.ok || !nftData || !nftData.success || !nftData.data) {
        setError('Không tìm thấy lô thuốc. Vui lòng kiểm tra lại mã.');
        setIsLoading(false);
        return;
      }
      setDrugData(nftData.data);
    } catch {
      setError('Đã xảy ra lỗi khi tra cứu. Vui lòng thử lại.');
      setIsLoading(false);
    }
  };

  // Auto-lookup from URL params
  useEffect(() => {
    const batchParam = searchParams.get('batch');
    if (batchParam && !drugData && !isLoading && !error && !autoRan) {
      setAutoRan(true);
      lookupDrug(batchParam);
    }
  }, [searchParams, drugData, isLoading, error, autoRan, lookupDrug]);

  const handleQRScan = (result: string) => {
    if (result.includes('/lookup?batch=') || result.includes('/public?batch=') || result.includes('/public-lookup?batch=')) {
      try {
        const url = new URL(result);
        const batch = url.searchParams.get('batch');
        if (batch) {
          lookupDrug(batch);
          return;
        }
      } catch {
        // fallback
      }
    }
    lookupDrug(result);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'minted':
        return { label: 'Vừa sản xuất', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '🏭' };
      case 'at_distributor':
        return { label: 'Đang vận chuyển', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '🚚' };
      case 'at_pharmacy':
        return { label: 'Tại hiệu thuốc', color: 'bg-green-100 text-green-800 border-green-200', icon: '🏥' };
      case 'dispensed':
        return { label: 'Đã phát hành', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: '✅' };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800 border-gray-200', icon: '📦' };
    }
  };

  const truncate = (str: string, start = 6, end = 4) =>
    str.length > start + end + 3 ? `${str.slice(0, start)}...${str.slice(-end)}` : str;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white py-8 sm:py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/20 backdrop-blur-sm mb-4 sm:mb-5">
            <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">Tra Cứu Nguồn Gốc Thuốc</h1>
          <p className="text-blue-100 text-sm sm:text-base">
            Quét mã QR hoặc nhập mã lô để xác minh tính xác thực
          </p>
          <div className="mt-4 inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs sm:text-sm text-blue-100">
            <Info className="w-3.5 h-3.5" />
            Dịch vụ miễn phí - Không cần kết nối ví
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 md:py-10">
        {/* Scanner / Manual Search Card */}
        <Card className="shadow-xl border-0 mb-6 sm:mb-8">
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <QrCode className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              Tra cứu sản phẩm
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode Toggle */}
            <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
              <button
                onClick={() => setScanMode('qr')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-medium transition-all ${
                  scanMode === 'qr'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span className="hidden sm:inline">Quét QR</span>
                <span className="sm:hidden">QR</span>
              </button>
              <button
                onClick={() => setScanMode('manual')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-medium transition-all ${
                  scanMode === 'manual'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Nhập mã</span>
                <span className="sm:hidden">Mã</span>
              </button>
            </div>

            {scanMode === 'qr' ? (
              <QRScanner onScan={handleQRScan} />
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (query.trim()) lookupDrug(query.trim());
                }}
                className="space-y-3"
              >
                <div>
                  <Label htmlFor="batchName" className="text-sm font-medium">Tên lô thuốc</Label>
                  <Input
                    id="batchName"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Nhập tên lô thuốc (ví dụ: Paracetamol 500mg)"
                    className="mt-1.5 h-11 sm:h-12 text-sm sm:text-base"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!query.trim() || isLoading}
                  className="w-full h-11 sm:h-12 text-sm sm:text-base"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang tra cứu...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Tra cứu
                    </>
                  )}
                </Button>
              </form>
            )}

            {/* Demo buttons */}
            <div className="border-t pt-3 sm:pt-4">
              <p className="text-xs text-gray-500 mb-2 text-center">Thử nghiệm nhanh:</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => lookupDrug('1001')}
                  disabled={isLoading}
                  className="h-10 text-xs sm:text-sm"
                >
                  Thuốc chính hãng
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => lookupDrug('9999')}
                  disabled={isLoading}
                  className="h-10 text-xs sm:text-sm"
                >
                  Thuốc cảnh báo
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <Card className="shadow-lg border-0">
            <CardContent className="py-10 sm:py-14 flex flex-col items-center gap-4">
              <div className="relative">
                <Loader2 className="w-12 h-12 sm:w-16 sm:h-16 text-blue-500 animate-spin" />
                <Package className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400 absolute inset-0 m-auto" />
              </div>
              <p className="text-gray-600 font-medium text-sm sm:text-base">Đang tra cứu trên blockchain...</p>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card className="shadow-lg border-0 bg-gradient-to-r from-red-50 to-pink-50">
            <CardContent className="py-6 sm:py-8">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7 text-red-600" />
                </div>
                <div>
                  <p className="font-semibold text-red-800 text-base sm:text-lg mb-1">Không tìm thấy</p>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {drugData && !isLoading && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Status Banner */}
            <Card className="shadow-lg border-0 overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 sm:p-6">
                <div className="flex items-center gap-3 text-white">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg sm:text-xl">Thuốc chính hãng</h3>
                    <p className="text-green-100 text-xs sm:text-sm">Đã xác thực trên blockchain Sui</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800">{drugData.name}</h2>
                  <p className="text-gray-500 text-xs sm:text-sm mt-1">Mã lô: {drugData.batch_number}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-gray-50 rounded-xl p-3 sm:p-4">
                    <p className="text-xs text-gray-500 mb-1">Trạng thái</p>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs sm:text-sm font-semibold border ${getStatusInfo(drugData.status).color}`}>
                      <span>{getStatusInfo(drugData.status).icon}</span>
                      {getStatusInfo(drugData.status).label}
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 sm:p-4">
                    <p className="text-xs text-gray-500 mb-1">Ngày sản xuất</p>
                    <p className="text-sm sm:text-base font-medium text-gray-700">{drugData.manufacture_date}</p>
                  </div>
                </div>

                {drugData.description && (
                  <div className="bg-gray-50 rounded-xl p-3 sm:p-4">
                    <p className="text-xs text-gray-500 mb-1">Mô tả</p>
                    <p className="text-sm sm:text-base text-gray-700">{drugData.description}</p>
                  </div>
                )}

                {/* Addresses */}
                <div className="space-y-2 sm:space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Chuỗi cung ứng</p>
                  <div className="bg-gray-50 rounded-xl p-3 sm:p-4 space-y-2 text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 font-medium min-w-[80px]">Nhà SX:</span>
                      <span className="font-mono text-gray-700 break-all">{truncate(drugData.manufacturer_address)}</span>
                    </div>
                    {drugData.distributor_address && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 font-medium min-w-[80px]">Phân phối:</span>
                        <span className="font-mono text-gray-700 break-all">{truncate(drugData.distributor_address)}</span>
                      </div>
                    )}
                    {drugData.pharmacy_address && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 font-medium min-w-[80px]">Hiệu thuốc:</span>
                        <span className="font-mono text-gray-700 break-all">{truncate(drugData.pharmacy_address)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Blockchain Info - TX Hash, Object ID, IPFS */}
                {(drugData.object_id || drugData.transaction_digest || drugData.transaction_hash || drugData.ipfs_hash) && (
                  <div className="space-y-2 sm:space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Thông tin Blockchain</p>
                    <div className="bg-gray-50 rounded-xl p-3 sm:p-4 space-y-2 text-xs sm:text-sm">
                      {drugData.object_id && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-gray-500 font-medium flex-shrink-0">Object ID:</span>
                          <button
                            onClick={() => drugData.object_id && window.open(getSuiExplorerObjectUrl(drugData.object_id), "_blank")}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-mono text-right flex items-center gap-1"
                            title={drugData.object_id || ''}
                          >
                            {drugData.object_id.slice(0, 12)}...{drugData.object_id.slice(-8)}
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </button>
                        </div>
                      )}
                      {(drugData.transaction_digest || drugData.transaction_hash) && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-gray-500 font-medium flex-shrink-0">TX Hash:</span>
                          <button
                            onClick={() => window.open(getSuiExplorerTxUrl(drugData.transaction_digest || drugData.transaction_hash || ''), "_blank")}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-mono text-right flex items-center gap-1"
                            title={drugData.transaction_digest || drugData.transaction_hash}
                          >
                            {(drugData.transaction_digest || drugData.transaction_hash || '').slice(0, 12)}...{(drugData.transaction_digest || drugData.transaction_hash || '').slice(-8)}
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </button>
                        </div>
                      )}
                      {drugData.ipfs_hash && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-gray-500 font-medium flex-shrink-0">IPFS:</span>
                          <button
                            onClick={() => window.open(`https://gateway.pinata.cloud/ipfs/${drugData.ipfs_hash}`, "_blank")}
                            className="text-purple-600 hover:text-purple-800 hover:underline font-mono text-right flex items-center gap-1"
                            title={drugData.ipfs_hash}
                          >
                            {drugData.ipfs_hash.slice(0, 12)}...{drugData.ipfs_hash.slice(-8)}
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {drugData.object_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs bg-transparent"
                          onClick={() => drugData.object_id && window.open(getSuiExplorerObjectUrl(drugData.object_id), "_blank")}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Xem NFT trên Suivision
                        </Button>
                      )}
                      {(drugData.transaction_digest || drugData.transaction_hash) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs bg-transparent"
                          onClick={() => window.open(getSuiExplorerTxUrl(drugData.transaction_digest || drugData.transaction_hash || ''), "_blank")}
                        >
                          <Link2 className="w-3 h-3 mr-1" />
                          Xem Transaction
                        </Button>
                      )}
                      {drugData.ipfs_hash && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs bg-transparent"
                          onClick={() => window.open(`https://gateway.pinata.cloud/ipfs/${drugData.ipfs_hash}`, "_blank")}
                        >
                          <Package className="w-3 h-3 mr-1" />
                          Xem Metadata IPFS
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {drugData.image_url && (
                  <img
                    src={drugData.image_url}
                    alt="Ảnh thuốc"
                    className="w-full max-w-xs mx-auto rounded-xl"
                    loading="lazy"
                    decoding="async"
                  />
                )}
              </CardContent>
            </Card>

            {/* Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Card className="shadow-md border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
                <CardContent className="pt-4 sm:pt-5 pb-4 sm:pb-5 text-center">
                  <ShieldCheck className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600 mx-auto mb-2" />
                  <h4 className="font-semibold text-sm sm:text-base text-gray-800 mb-1">Xác minh Blockchain</h4>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Thông tin được ghi nhận trên blockchain Sui, đảm bảo tính minh bạch
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-md border-0 bg-gradient-to-br from-green-50 to-emerald-50">
                <CardContent className="pt-4 sm:pt-5 pb-4 sm:pb-5 text-center">
                  <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-green-600 mx-auto mb-2" />
                  <h4 className="font-semibold text-sm sm:text-base text-gray-800 mb-1">Sản phẩm xác thực</h4>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Sản phẩm này đã được kiểm tra và xác minh thành công
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!drugData && !isLoading && !error && (
          <Card className="shadow-lg border-0">
            <CardContent className="py-10 sm:py-14 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <QrCode className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-700 mb-2">Quét mã để bắt đầu</h3>
              <p className="text-gray-500 text-sm sm:text-base max-w-md mx-auto">
                Quét mã QR trên hộp thuốc hoặc nhập mã để xác minh nguồn gốc
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function PublicLookupPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }>
        <PublicLookupContent />
      </Suspense>
    </ErrorBoundary>
  );
}
