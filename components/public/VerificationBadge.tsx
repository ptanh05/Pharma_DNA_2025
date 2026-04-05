/**
 * Component: VerificationBadge
 * Hiển thị trạng thái xác minh sản phẩm trên blockchain
 */

'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Shield, ExternalLink, RefreshCw } from 'lucide-react';

interface NFTData {
  batch_number: string;
  ipfs_hash: string;
  token_id?: string;
  object_id?: string;
  transaction_digest?: string;
  transaction_hash?: string;
  [key: string]: any;
}

interface VerificationStatus {
  verified: boolean | null;
  loading: boolean;
  error: string | null;
  blockchainInfo?: {
    owner?: string;
    status?: string;
    lastUpdated?: string;
  };
}

export function VerificationBadge({ nft }: { nft: NFTData }) {
  const [verification, setVerification] = useState<VerificationStatus>({
    verified: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    verifyOnBlockchain();
  }, [nft.batch_number]);

  const verifyOnBlockchain = async () => {
    try {
      setVerification({ verified: null, loading: true, error: null });

      const response = await fetch(`/api/public/verify?batch=${encodeURIComponent(nft.batch_number)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Lỗi xác minh');
      }

      setVerification({
        verified: data.verified === true,
        loading: false,
        error: null,
        blockchainInfo: data.blockchainInfo,
      });
    } catch (error: any) {
      setVerification({
        verified: false,
        loading: false,
        error: error.message,
      });
    }
  };

  const { verified, loading, error, blockchainInfo } = verification;

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-6 border border-blue-100">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="relative">
            <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-blue-500 animate-spin" />
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400 absolute inset-0 m-auto" />
          </div>
          <div className="text-center">
            <p className="text-blue-700 font-medium text-sm sm:text-base">Đang xác minh trên blockchain...</p>
            <p className="text-blue-500 text-xs sm:text-sm mt-1">Vui lòng chờ trong giây lát</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 sm:p-6 border border-amber-200">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-amber-800 font-bold text-base sm:text-lg mb-1">Không Thể Xác Minh</p>
            <p className="text-amber-700 text-xs sm:text-sm">{error}</p>
            <button
              onClick={verifyOnBlockchain}
              className="mt-3 inline-flex items-center gap-1.5 text-amber-800 hover:text-amber-900 text-xs sm:text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (verified) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 sm:p-6 border border-green-200">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-green-800 font-bold text-base sm:text-lg">Sản Phẩm Xác Thực</p>
              <span className="inline-flex items-center gap-1 bg-green-200 text-green-800 text-xs px-2 py-0.5 rounded-full font-medium">
                <Shield className="w-3 h-3" />
                Blockchain
              </span>
            </div>
            <p className="text-green-700 text-xs sm:text-sm mb-3 sm:mb-4">
              Sản phẩm này đã được xác minh trên blockchain Sui. Tất cả thông tin lịch sử chuỗi cung ứng là chính xác và không thể thay đổi.
            </p>

            {blockchainInfo && (
              <div className="bg-white/60 rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm space-y-1.5 sm:space-y-2">
                {blockchainInfo.owner && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                    <span className="text-green-700 font-semibold whitespace-nowrap">Chủ sở hữu:</span>
                    <span className="font-mono text-green-800 break-all bg-green-50 px-2 py-0.5 rounded text-xs">{blockchainInfo.owner}</span>
                  </div>
                )}
                {blockchainInfo.lastUpdated && (
                  <div className="flex items-center gap-2">
                    <span className="text-green-700 font-semibold">Cập nhật:</span>
                    <span className="text-green-800">{formatDate(blockchainInfo.lastUpdated)}</span>
                  </div>
                )}
                {nft.object_id && (
                  <div className="flex items-center gap-2">
                    <span className="text-green-700 font-semibold">Object ID:</span>
                    <a
                      href={`https://suivision.xyz/object/${nft.object_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-mono break-all"
                    >
                      {nft.object_id.slice(0, 20)}...
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </div>
                )}
                {nft.ipfs_hash && (
                  <div className="flex items-center gap-2">
                    <span className="text-green-700 font-semibold">IPFS:</span>
                    <a
                      href={`https://gateway.pinata.cloud/ipfs/${nft.ipfs_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-mono break-all"
                    >
                      {nft.ipfs_hash.slice(0, 20)}...
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </div>
                )}
                {nft.transaction_digest && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                    <span className="text-green-700 font-semibold whitespace-nowrap">TX Digest:</span>
                    <a
                      href={`https://suivision.xyz/txblock/${nft.transaction_digest}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-mono break-all bg-green-50 px-2 py-0.5 rounded"
                    >
                      {nft.transaction_digest.slice(0, 20)}...
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-4 sm:p-6 border border-red-200">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-red-400 to-pink-600 flex items-center justify-center shadow-lg">
          <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-red-800 font-bold text-base sm:text-lg mb-1">Xác Minh Thất Bại</p>
          <p className="text-red-700 text-xs sm:text-sm mb-3">
            Không thể xác minh sản phẩm này trên blockchain. Sản phẩm có thể không tồn tại hoặc thông tin không khớp.
          </p>
          <div className="text-xs sm:text-sm text-red-700 bg-white/60 rounded-lg px-3 py-2.5 sm:px-4 sm:py-3">
            <p className="font-semibold mb-1.5">Có thể do:</p>
            <ul className="space-y-0.5 sm:space-y-1">
              <li className="flex items-start gap-1.5">
                <span className="text-red-500 mt-0.5">&#x2022;</span>
                <span>Mã lô không chính xác</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-red-500 mt-0.5">&#x2022;</span>
                <span>Sản phẩm chưa đăng ký trên blockchain</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-red-500 mt-0.5">&#x2022;</span>
                <span>Lỗi tạm thời của hệ thống</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-red-500 mt-0.5">&#x2022;</span>
                <span className="font-medium text-red-800">Sản phẩm giả mạo</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}
