"use client";

export default function ProductDetailCard({ nft }: { nft: any }) {
  return (
    <div className="bg-white border rounded-lg shadow-md p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">{nft.name}</h2>
          <p className="text-gray-600">Batch Number: {nft.batch_number}</p>
        </div>
        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full">
          {nft.status}
        </span>
      </div>
      
      <div className="mt-6 space-y-2">
        <div className="flex justify-between">
          <span className="font-semibold">Ngày sản xuất:</span>
          <span>{new Date(nft.created_at).toLocaleDateString('vi-VN')}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold">Hết hạn:</span>
          <span>{new Date(nft.expiry_date).toLocaleDateString('vi-VN')}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold">Nhà sản xuất:</span>
          <span className="text-blue-600">{nft.manufacturer_address?.slice(0, 8)}...</span>
        </div>
      </div>

      <div className="mt-6 p-3 bg-blue-50 rounded">
        <p className="text-sm text-blue-800">
          ✓ Đã xác thực trên blockchain
        </p>
      </div>
    </div>
  );
}
