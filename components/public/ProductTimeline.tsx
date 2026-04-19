/**
 * Component: ProductTimeline
 * Hiển thị chuỗi cung ứng sản phẩm qua các bước
 */

'use client';

import { useState, useEffect } from 'react';
import { Factory, Truck, Building2, ShoppingBag, Check, Loader2 } from 'lucide-react';

interface NFTData {
  id?: number;
  batch_number: string;
  product_name: string;
  status: string;
  manufacturer_address: string;
  distributor_address?: string;
  pharmacy_address?: string;
  created_at: string;
}

interface Milestone {
  id: number;
  nft_id: number;
  type: string;
  description: string | null;
  location: string | null;
  timestamp: string;
  actor_address: string;
}

export function ProductTimeline({ nft }: { nft: NFTData }) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchMilestones() {
      if (!nft?.batch_number && !nft?.id) return;
      setLoading(true);
      try {
        const params = nft.batch_number
          ? `batch_number=${encodeURIComponent(nft.batch_number)}`
          : `nft_id=${nft.id}`;
        const res = await fetch(`/api/manufacturer/milestone?${params}`);
        const data = await res.json();
        const records = Array.isArray(data) ? data : (data?.data ?? []);
        setMilestones(records);
      } catch {
        setMilestones([]);
      } finally {
        setLoading(false);
      }
    }
    fetchMilestones();
  }, [nft?.batch_number, nft?.id]);

  // Build events from milestones if available, otherwise fall back to NFT status
  let events: any[] = [];

  if (milestones.length > 0) {
    // Use actual milestone records
    events = milestones.map((m, idx) => ({
      step: idx + 1,
      title: m.type || 'Mốc vận chuyển',
      status: 'completed',
      actor: m.actor_address,
      timestamp: m.timestamp,
      description: m.description || '',
      location: m.location,
    }));
  } else {
    // Fallback: build from NFT state
    events = [
      {
        step: 1,
        title: 'Sản Xuất',
        status: 'completed',
        actor: nft.manufacturer_address,
        timestamp: nft.created_at,
        description: 'Sản phẩm được sản xuất và đóng gói',
      },
    ];

    if (nft.distributor_address) {
      events.push({
        step: 2,
        title: 'Vận Chuyển',
        status: nft.status === 'at_distributor' || nft.status === 'at_pharmacy' || nft.status === 'dispensed' ? 'completed' : 'pending',
        actor: nft.distributor_address,
        timestamp: nft.created_at,
        description: 'Sản phẩm được vận chuyển đến nhà phân phối',
      });
    }

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
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6 sm:mb-8">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-100 flex items-center justify-center">
          <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-gray-800">Lịch Sử Chuỗi Cung Ứng</h3>
          <p className="text-xs sm:text-sm text-gray-500">Theo dõi hành trình sản phẩm</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4 sm:space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <p className="text-sm">Đang tải lịch sử...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Truck className="w-10 h-10 mb-2" />
            <p className="text-sm">Chưa có mốc vận chuyển nào</p>
          </div>
        ) : events.map((event, index) => (
          <div key={event.step} className="flex gap-3 sm:gap-6">
            {/* Timeline Dot with Icon */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-md transition-all duration-300 ${
                  event.status === 'completed'
                    ? 'bg-gradient-to-br from-green-400 to-green-600 text-white scale-100'
                    : event.status === 'in_progress'
                      ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white scale-100'
                      : 'bg-gray-200 text-gray-500 scale-95'
                }`}
              >
                {event.status === 'completed' ? (
                  <Check className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={3} />
                ) : (
                  getStepIcon(event.step, 'w-5 h-5 sm:w-6 sm:h-6')
                )}
              </div>

              {/* Connecting Line with gradient */}
              {index < events.length - 1 && (
                <div className={`w-1 flex-1 my-2 min-h-[2rem] sm:min-h-[3rem] rounded-full ${
                  events[index + 1].status === 'completed' || events[index + 1].status === 'in_progress'
                    ? 'bg-gradient-to-b from-green-400 to-blue-400'
                    : 'bg-gray-200'
                }`} />
              )}
            </div>

            {/* Event Content */}
            <div className="flex-1 pt-1 sm:pt-2 pb-2 sm:pb-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <h4 className={`text-base sm:text-lg font-semibold ${
                    event.status === 'completed' ? 'text-green-700' : 'text-gray-700'
                  }`}>
                    {event.title}
                  </h4>
                  {event.status === 'completed' && (
                    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" />
                      Đã xác nhận
                    </span>
                  )}
                </div>
                <span className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">{formatDate(event.timestamp)}</span>
              </div>

              <p className="text-gray-600 mb-2 text-sm sm:text-base">{event.description}</p>

              {/* Actor Info */}
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs sm:text-sm border border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-medium">Địa chỉ:</span>
                  <span className="font-mono text-gray-700 break-all leading-relaxed">{event.actor}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status Legend */}
      <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-100">
        <p className="text-xs sm:text-sm font-semibold text-gray-600 mb-3">Trạng thái:</p>
        <div className="grid grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex-shrink-0"></div>
            <span className="text-gray-600">Hoàn thành</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex-shrink-0"></div>
            <span className="text-gray-600">Đang thực hiện</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-gray-300 flex-shrink-0"></div>
            <span className="text-gray-600">Chưa bắt đầu</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getStepIcon(step: number, className: string) {
  switch (step) {
    case 1: return <Factory className={className} />;
    case 2: return <Truck className={className} />;
    case 3: return <Building2 className={className} />;
    case 4: return <ShoppingBag className={className} />;
    default: return <span className={className}>{step}</span>;
  }
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
