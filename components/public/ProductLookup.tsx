/**
 * Component: ProductLookup
 * Tìm kiếm công khai sản phẩm theo batch number hoặc NFT ID
 */

'use client';

import { useState, FormEvent } from 'react';
import { Search, Package, QrCode, Loader2, AlertCircle, ShieldCheck, Clock, MapPin, Factory, ChevronRight, ImageIcon, FileText, Hash, DollarSign, CalendarCheck, Truck, CheckCircle2, RefreshCw } from 'lucide-react';
import { ProductTimeline } from './ProductTimeline';
import { VerificationBadge } from './VerificationBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface NFTData {
  id: number;
  batch_number: string;
  product_name: string;
  status: string;
  manufacturer_address: string;
  distributor_address?: string;
  pharmacy_address?: string;
  ipfs_hash: string;
  created_at: string;
  expiration_date?: string;
  description?: string;
  image_url?: string;
  certificate_url?: string;
  quantity?: number;
  manufacture_date?: string;
  expiry_date?: string;
  token_id?: string;
  object_id?: string;
  transaction_digest?: string;
  transaction_hash?: string;
  last_dispensed_at?: string;
  receipt_confirmed_at?: string;
  updated_at?: string;
}

export function ProductLookup() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<NFTData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [searchType, setSearchType] = useState<'batch' | 'nftId' | null>(null);

  const handleSearch = async (e?: FormEvent, searchQuery?: string) => {
    if (e) e.preventDefault();
    const q = searchQuery ?? query;
    if (!q.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);
    setHasSearched(true);

    try {
      const isNumeric = /^\d+$/.test(q);
      const params = isNumeric ? `nftId=${q}` : `batch=${encodeURIComponent(q)}`;
      const res = await fetch(`/api/public/lookup?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi tìm kiếm');
      }

      if (data.success && data.data) {
        setResult(data.data);
        setSearchType(isNumeric ? 'nftId' : 'batch');
      } else {
        setError('Không tìm thấy sản phẩm với mã này. Vui lòng kiểm tra lại mã lô hoặc NFT ID.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tìm kiếm. Vui lòng thử lại.');
      console.error('[ProductLookup] Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResult(null);
    setError('');
    setHasSearched(false);
    setSearchType(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white py-10 sm:py-14 md:py-16 px-4">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1cmwoI2dyaWQpIj48cGF0aCBkPSJNIDYgMCBMIDAgNiBMIDYgNiBMIDYgMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')]" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 backdrop-blur-sm mb-4 sm:mb-6">
            <ShieldCheck className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3">Xác Minh Tính Xác Thực Sản Phẩm</h1>
          <p className="text-blue-100 text-sm sm:text-base md:text-lg max-w-2xl mx-auto">
            Nhập mã lô hoặc NFT ID để xem lịch sử chuỗi cung ứng đầy đủ trên blockchain
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 md:py-10">
        {/* Search Form Card */}
        <Card className="shadow-xl border-0 mb-6 sm:mb-8">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <QrCode className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              Tra cứu sản phẩm
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSearch} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Nhập batch number hoặc NFT ID..."
                    className="w-full pl-10 sm:pl-11 pr-4 py-3 sm:py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base transition-all"
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading || !query.trim()}
                  size="lg"
                  className="w-full sm:w-auto min-h-[48px] sm:min-h-[52px] gap-2 text-base"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang tìm...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Tìm Kiếm
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs sm:text-sm text-gray-500">
                Ví dụ: BATCH-20260211-001 hoặc 123
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-4 sm:p-5 mb-6 sm:mb-8">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-red-800 text-sm sm:text-base">Không tìm thấy sản phẩm</p>
                <p className="text-red-700 text-xs sm:text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Search Results */}
        {result && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Product Info Card */}
            <Card className="shadow-lg border-0 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 sm:p-6">
                <div className="flex items-center gap-3 text-white">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold truncate">{result.product_name}</h2>
                    <p className="text-blue-100 text-xs sm:text-sm">Mã lô: {result.batch_number}</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-4 sm:p-6">
                {/* Product Image & Description Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
                  {/* Product Image */}
                  <div className="md:col-span-1">
                    {result.image_url ? (
                      <div className="relative rounded-xl overflow-hidden bg-gray-50 border border-gray-100 aspect-square">
                        <img
                          src={result.image_url}
                          alt={result.product_name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                        <div className="hidden absolute inset-0 flex items-center justify-center bg-gray-50">
                          <ImageIcon className="w-12 h-12 text-gray-300" />
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-square rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 border border-gray-100 flex items-center justify-center">
                        <Package className="w-12 h-12 text-blue-300" />
                      </div>
                    )}
                  </div>

                  {/* Description & Details */}
                  <div className="md:col-span-2 space-y-3 sm:space-y-4">
                    {/* Description */}
                    {result.description && (
                      <div>
                        <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Mô Tả Sản Phẩm</p>
                        <p className="text-sm sm:text-base text-gray-700 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">{result.description}</p>
                      </div>
                    )}

                    {/* Quick Info Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                      <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-center border border-gray-100">
                        <p className="text-xs text-gray-500 mb-0.5">Mã Lô</p>
                        <p className="font-mono text-xs sm:text-sm font-semibold text-gray-800 truncate" title={result.batch_number}>{result.batch_number.split('-').pop() || result.batch_number}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-center border border-gray-100">
                        <p className="text-xs text-gray-500 mb-0.5">NFT ID</p>
                        <p className="font-mono text-xs sm:text-sm font-semibold text-gray-800">#{result.id}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-center border border-gray-100">
                        <p className="text-xs text-gray-500 mb-0.5">Số Lượng</p>
                        <p className="font-mono text-xs sm:text-sm font-semibold text-gray-800">{result.quantity ?? '—'}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-center border border-gray-100">
                        <p className="text-xs text-gray-500 mb-0.5">Trạng Thái</p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(result.status)}`}>
                          {getStatusIcon(result.status)}
                          {translateStatusShort(result.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dates & Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-4 sm:mb-5">
                  <div className="bg-blue-50 rounded-lg px-3 py-2.5 border border-blue-100">
                    <p className="text-xs text-blue-500 font-medium mb-0.5">Ngày SX</p>
                    <p className="text-xs sm:text-sm font-semibold text-blue-800">{formatDateShort(result.manufacture_date || result.created_at)}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg px-3 py-2.5 border border-red-100">
                    <p className="text-xs text-red-500 font-medium mb-0.5">Hết Hạn</p>
                    <p className="text-xs sm:text-sm font-semibold text-red-800">{result.expiry_date || result.expiration_date ? formatDateShort((result.expiry_date || result.expiration_date) as string) : '—'}</p>
                  </div>
                  {result.last_dispensed_at && (
                    <div className="bg-purple-50 rounded-lg px-3 py-2.5 border border-purple-100">
                      <p className="text-xs text-purple-500 font-medium mb-0.5">Phát Hành</p>
                      <p className="text-xs sm:text-sm font-semibold text-purple-800">{formatDateShort(result.last_dispensed_at)}</p>
                    </div>
                  )}
                  {result.receipt_confirmed_at && (
                    <div className="bg-green-50 rounded-lg px-3 py-2.5 border border-green-100">
                      <p className="text-xs text-green-500 font-medium mb-0.5">Xác Nhận</p>
                      <p className="text-xs sm:text-sm font-semibold text-green-800">{formatDateShort(result.receipt_confirmed_at)}</p>
                    </div>
                  )}
                  {result.updated_at && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                      <p className="text-xs text-gray-500 font-medium mb-0.5">Cập Nhật</p>
                      <p className="text-xs sm:text-sm font-semibold text-gray-700">{formatDateShort(result.updated_at)}</p>
                    </div>
                  )}
                  {result.quantity !== undefined && result.quantity > 0 && (
                    <div className="bg-amber-50 rounded-lg px-3 py-2.5 border border-amber-100">
                      <p className="text-xs text-amber-600 font-medium mb-0.5">Tồn Kho</p>
                      <p className="text-xs sm:text-sm font-semibold text-amber-800">{result.quantity}</p>
                    </div>
                  )}
                </div>

                {/* Blockchain IDs */}
                {(result.token_id || result.object_id || result.transaction_digest) && (
                  <div className="mb-4 sm:mb-5">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 mb-2">Thông Tin Blockchain</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                      {result.token_id && (
                        <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                          <p className="text-xs text-slate-500 font-medium mb-0.5">Token ID</p>
                          <p className="font-mono text-xs text-slate-700 break-all">{result.token_id}</p>
                        </div>
                      )}
                      {result.object_id && (
                        <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                          <p className="text-xs text-slate-500 font-medium mb-0.5">Object ID</p>
                          <p className="font-mono text-xs text-slate-700 break-all">{result.object_id}</p>
                        </div>
                      )}
                      {result.transaction_digest && (
                        <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                          <p className="text-xs text-slate-500 font-medium mb-0.5">TX Digest</p>
                          <p className="font-mono text-xs text-slate-700 break-all">{result.transaction_digest.slice(0, 16)}...</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Certificate */}
                {result.certificate_url && (
                  <div className="mb-4 sm:mb-5">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 mb-2">Giấy Chứng Nhận</p>
                    <a
                      href={result.certificate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2.5 rounded-lg border border-green-200 transition-colors text-sm font-medium"
                    >
                      <FileText className="w-4 h-4" />
                      Xem Giấy Chứng Nhận
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                {/* Address Summary */}
                <div className="pt-4 sm:pt-5 border-t border-gray-100">
                  <p className="text-xs sm:text-sm font-medium text-gray-500 mb-2 sm:mb-3">Hành trình sản phẩm:</p>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                    <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 sm:px-3 py-1.5 rounded-full">
                      <Factory className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      Nhà sản xuất
                    </div>
                    {result.distributor_address && (
                      <>
                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                        <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-2.5 sm:px-3 py-1.5 rounded-full">
                          <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          Nhà phân phối
                        </div>
                      </>
                    )}
                    {result.pharmacy_address && (
                      <>
                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                        <div className="flex items-center gap-1.5 bg-purple-50 text-purple-700 px-2.5 sm:px-3 py-1.5 rounded-full">
                          <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          Hiệu thuốc
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <ProductTimeline nft={result} />

            {/* Verification Badge */}
            <VerificationBadge nft={result} />
          </div>
        )}

        {/* Empty State */}
        {!result && !loading && !error && !hasSearched && (
          <div className="bg-white rounded-xl shadow-lg p-8 sm:p-10 md:p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-50 mb-4 sm:mb-6">
              <QrCode className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-700 mb-2">Tra cứu sản phẩm</h3>
            <p className="text-gray-500 text-sm sm:text-base max-w-md mx-auto">
              Nhập mã lô hoặc NFT ID trên hộp thuốc để xác minh nguồn gốc và xem lịch sử chuỗi cung ứng
            </p>
            <div className="mt-6 sm:mt-8 flex flex-wrap justify-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2 bg-gray-50 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm text-gray-600">
                <ShieldCheck className="w-4 h-4 text-green-500" />
                Xác minh blockchain
              </div>
              <div className="flex items-center gap-2 bg-gray-50 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm text-gray-600">
                <Clock className="w-4 h-4 text-blue-500" />
                Theo dõi hành trình
              </div>
              <div className="flex items-center gap-2 bg-gray-50 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm text-gray-600">
                <Package className="w-4 h-4 text-purple-500" />
                Kiểm tra chất lượng
              </div>
            </div>
          </div>
        )}

        {/* Searched but no results */}
        {!result && !loading && !error && hasSearched && (
          <div className="bg-white rounded-xl shadow-lg p-8 sm:p-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 mb-4">
              <AlertCircle className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">Không tìm thấy kết quả</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
              Không có sản phẩm nào khớp với mã tra cứu của bạn
            </p>
            <Button onClick={clearSearch} variant="outline" size="lg">
              Thử lại với mã khác
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function translateStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'minted': 'Vừa sản xuất',
    'at_distributor': 'Đang vận chuyển',
    'at_pharmacy': 'Tại hiệu thuốc',
    'dispensed': 'Đã phát hành',
  };
  return statusMap[status] || status;
}

function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    'minted': 'bg-blue-100 text-blue-800',
    'at_distributor': 'bg-yellow-100 text-yellow-800',
    'at_pharmacy': 'bg-green-100 text-green-800',
    'dispensed': 'bg-purple-100 text-purple-800',
  };
  return colorMap[status] || 'bg-gray-100 text-gray-800';
}

function getStatusIcon(status: string): React.ReactNode {
  const iconMap: Record<string, string> = {
    'minted': '🏭',
    'at_distributor': '🚚',
    'at_pharmacy': '🏥',
    'dispensed': '✅',
  };
  return <span>{iconMap[status] || '📦'}</span>;
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function translateStatusShort(status: string): string {
  const statusMap: Record<string, string> = {
    'minted': 'SX',
    'at_distributor': 'VC',
    'at_pharmacy': 'HT',
    'dispensed': 'PH',
  };
  return statusMap[status] || status;
}

function formatDateShort(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateString;
  }
}

// ExternalLink icon (inline SVG to avoid extra import)
function ExternalLink({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}