/**
 * Component: ProductTimeline
 * Hiển thị chuỗi cung ứng sản phẩm qua các bước
 */

'use client';

interface NFTData {
  batch_number: string;
  product_name: string;
  status: string;
  manufacturer_address: string;
  distributor_address?: string;
  pharmacy_address?: string;
  created_at: string;
}

export function ProductTimeline({ nft }: { nft: NFTData }) {
  // Xây dựng timeline events
  const events = [
    {
      step: 1,
      title: 'Sản Xuất',
      status: 'completed',
      actor: nft.manufacturer_address,
      timestamp: nft.created_at,
      description: 'Sản phẩm được sản xuất và đóng gói',
    },
  ];

  // Thêm distributor event nếu có
  if (nft.distributor_address) {
    events.push({
      step: 2,
      title: 'Vận Chuyển',
      status: nft.status === 'at_distributor' || nft.status === 'at_pharmacy' || nft.status === 'dispensed' ? 'completed' : 'pending',
      actor: nft.distributor_address,
      timestamp: nft.created_at, // Trong thực tế cần track timestamp transfer
      description: 'Sản phẩm được vận chuyển đến nhà phân phối',
    });
  }

  // Thêm pharmacy event nếu có
  if (nft.pharmacy_address) {
    events.push({
      step: 3,
      title: 'Hiệu Thuốc',
      status: nft.status === 'at_pharmacy' || nft.status === 'dispensed' ? 'completed' : 'pending',
      actor: nft.pharmacy_address,
      timestamp: nft.created_at,
      description: 'Sản phẩm được nhận tại hiệu thuốc',
    });
  }

  // Thêm dispensed event nếu hoàn thành
  if (nft.status === 'dispensed') {
    events.push({
      step: nft.pharmacy_address ? 4 : 3,
      title: 'Phát Hành',
      status: 'completed',
      actor: nft.pharmacy_address || 'Unknown',
      timestamp: nft.created_at,
      description: 'Sản phẩm được phát hành cho người tiêu dùng',
    });
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <h3 className="text-xl font-bold text-gray-800 mb-8">Lịch Sử Chuỗi Cung Ứng</h3>

      {/* Timeline */}
      <div className="space-y-6">
        {events.map((event, index) => (
          <div key={event.step}className="flex gap-6">
            {/* Timeline Dot */}
            <div className="flex flex-col items-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
                  event.status === 'completed'
                    ? 'bg-green-500'
                    : event.status === 'in_progress'
                      ? 'bg-blue-500'
                      : 'bg-gray-300'
                }`}
              >
                {event.status === 'completed' ? '✓' : event.step}
              </div>

              {/* Connecting Line */}
              {index < events.length - 1 && (
                <div className="w-1 h-16 bg-gray-300 my-2"></div>
              )}
            </div>

            {/* Event Content */}
            <div className="flex-1 pt-2">
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-lg font-semibold text-gray-800">{event.title}</h4>
                <span className="text-sm text-gray-500">{formatDate(event.timestamp)}</span>
              </div>

              <p className="text-gray-600 mb-2">{event.description}</p>

              {/* Actor Info */}
              <div className="bg-gray-50 rounded px-3 py-2 text-sm">
                <span className="text-gray-600">Địa Chỉ: </span>
                <span className="font-mono text-gray-800 break-all">{event.actor}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status Legend */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <p className="text-sm font-semibold text-gray-700 mb-3">Huyền Thoại:</p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Hoàn Thành</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Đang Thực Hiện</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
            <span>Chưa Bắt Đầu</span>
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
      month: '2-digit',
      day: '2-digit',
    });
  }catch {
    return dateString;
  }
}
