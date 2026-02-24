/**
 * Component: VerificationBadge
 * Hiển thị trạng thái xác minh sản phẩm trên blockchain
 */

'use client';

import { useEffect, useState }from 'react';

interface NFTData {
  batch_number: string;
  ipfs_hash: string;
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

      // Gọi API để verify trên blockchain
      const response = await fetch(`/api/v1/public/verify?batch=${encodeURIComponent(nft.batch_number)}`);
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
    }catch (error: any) {
      setVerification({
        verified: false,
        loading: false,
        error: error.message,
      });
    }
  };

  const { verified, loading, error, blockchainInfo }= verification;

  if (loading) {
    return (
      <div className="bg-gray-100 rounded-lg p-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="animate-spin">⏳</span>
          <span className="text-gray-600">Đang xác minh trên blockchain...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-6">
        <p className="text-yellow-800 font-semibold mb-2">⚠️ Không Thể Xác Minh</p>
        <p className="text-yellow-700 text-sm">{error}</p>
        <button
          onClick={verifyOnBlockchain}
          className="mt-3 text-yellow-800 underline text-sm hover:text-yellow-900"
        >
          Thử Lại
        </button>
      </div>
    );
  }

  if (verified) {
    return (
      <div className="bg-green-100 border border-green-400 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="text-3xl">✓</div>
          <div>
            <p className="text-green-800 font-bold text-lg mb-2">Sản Phẩm Xác Thực</p>
            <p className="text-green-700 text-sm mb-4">
              Sản phẩm này đã được xác minh trên blockchain Sui. Tất cả thông tin lịch sử chuỗi cung ứng là chính xác và không thể thay đổi.
            </p>

            {blockchainInfo && (
              <div className="bg-white bg-opacity-50 rounded px-3 py-2 text-sm space-y-1">
                {blockchainInfo.owner && (
                  <div>
                    <span className="text-green-700 font-semibold">Chủ Sở Hữu Hiện Tại: </span>
                    <span className="font-mono text-green-800 break-all text-xs">{blockchainInfo.owner}</span>
                  </div>
                )}
                {blockchainInfo.lastUpdated && (
                  <div>
                    <span className="text-green-700 font-semibold">Cập Nhật Lần Cuối: </span>
                    <span className="text-green-800">{formatDate(blockchainInfo.lastUpdated)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Not verified
  return (
    <div className="bg-red-100 border border-red-400 rounded-lg p-6">
      <div className="flex items-start gap-4">
        <div className="text-3xl">✗</div>
        <div>
          <p className="text-red-800 font-bold text-lg mb-2">Xác Minh Thất Bại</p>
          <p className="text-red-700 text-sm mb-3">
            Không thể xác minh sản phẩm này trên blockchain. Có thể sản phẩm không tồn tại hoặc thông tin không khớp.
          </p>
          <div className="text-sm text-red-700 bg-white bg-opacity-50 rounded px-3 py-2">
            <p className="font-semibold mb-1">Điều Này Có Thể Là Do:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Mã lô không chính xác</li>
              <li>Sản phẩm chưa được đăng ký trên blockchain</li>
              <li>Lỗi tạm thời của hệ thống</li>
              <li>Sản phẩm giả mạo</li>
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
  }catch {
    return dateString;
  }
}
