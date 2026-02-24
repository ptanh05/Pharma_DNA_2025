/**
 * Component: ProductLookup
 * Tìm kiếm công khai sản phẩm theo batch number hoặc NFT ID
 */

'use client';

import { useState, FormEvent }from 'react';
import { ProductTimeline } from './ProductTimeline';
import { VerificationBadge }from './VerificationBadge';

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
}

export function ProductLookup() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<NFTData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchType, setSearchType] = useState<'batch' | 'nftId' | null>(null);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      // Xác định loại tìm kiếm (batch number hay NFT ID)
      const isNumeric = /^\d+$/.test(query);
      const params = isNumeric ? `nftId=${query}` : `batch=${encodeURIComponent(query)}`;

      const res = await fetch(`/api/v1/public/lookup?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi tìm kiếm');
      }

      if (data.success && data.data) {
        setResult(data.data);
        setSearchType(isNumeric ? 'nftId' : 'batch');
      }else {
        setError('Không tìm thấy sản phẩm');
      }
    }catch (err: any) {
      setError(err.message || 'Lỗi khi tìm kiếm');
      console.error('[ProductLookup] Search error:', err);
    }finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Xác Minh Tính Xác Thực Sản Phẩm</h1>
          <p className="text-gray-600">Nhập mã lô hoặc NFT ID để xem lịch sử chuỗi cung ứng</p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nhập batch number hoặc NFT ID..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={loading}
                autoFocus
              />
              <button
                type="submit"
                disabled={loading || !query}
                className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Đang tìm...
                  </span>
                ) : (
                  'Tìm Kiếm'
                )}
              </button>
            </div>

            {/* Help text */}
            <p className="text-sm text-gray-500">
              Ví dụ: BATCH-20260211-001 hoặc 123
            </p>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg mb-8">
            <p className="font-semibold">Lỗi</p>
            <p>{error}</p>
          </div>
        )}

        {/* Search Results */}
        {result && (
          <div className="space-y-6">
            {/* Product Info Card */}
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="grid grid-cols-2 gap-6">
                {/* Left column */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">{result.product_name}</h2>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-sm font-semibold text-gray-600">Mã Lô</dt>
                      <dd className="font-mono text-lg text-gray-800">{result.batch_number}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-semibold text-gray-600">Trạng Thái</dt>
                      <dd>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(result.status)}`}>
                          {translateStatus(result.status)}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Right column */}
                <div>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-sm font-semibold text-gray-600">Sản Xuất Ngày</dt>
                      <dd className="text-gray-800">{formatDate(result.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-semibold text-gray-600">Hết Hạn Ngày</dt>
                      <dd className="text-gray-800">
                        {result.expiration_date ? formatDate(result.expiration_date) : 'Chưa xác định'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <ProductTimeline nft={result} />

            {/* Verification Badge */}
            <VerificationBadge nft={result} />
          </div>
        )}

        {/* No Results Placeholder */}
        {!result && !loading && !error && (
          <div className="bg-gray-100 rounded-lg p-12 text-center">
            <p className="text-gray-600 text-lg">Nhập mã lô để bắt đầu tìm kiếm</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Utility functions
 */

function translateStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'minted': 'Vừa Sản Xuất',
    'at_distributor': 'Đang Vận Chuyển',
    'at_pharmacy': 'Tại Hiệu Thuốc',
    'dispensed': 'Đã Phát Hành',
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

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }catch {
    return dateString;
  }
}
