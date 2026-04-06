'use client';

import { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useSocket } from '@/hooks/useSocket';
import { useWalletSui } from '@/hooks/useWalletSui';
import { useRoleAuth } from '@/hooks/useRoleAuth';
import { toast } from 'sonner';

interface SSEEventData {
  type: string;
  title: string;
  message: string;
  data?: unknown;
}

/**
 * Notification Bell Component with Real-Time SSE Support
 */
export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { account } = useWalletSui();
  const { userRole } = useRoleAuth();
  const { notifications, unreadCount, markAsRead } = useNotifications(60000);

  // Real-time SSE connection
  useSocket(account, userRole, {
    onNotification: (data: unknown) => {
      const notif = data as SSEEventData;
      const toastType = notif.type === 'success' ? 'success'
        : notif.type === 'warning' ? 'warning'
        : notif.type === 'error' ? 'error'
        : 'info';
      toast[toastType](notif.title, {
        description: notif.message,
        duration: 6000,
      });
    },
    onTransferRequestCreated: (data: unknown) => {
      const d = data as { batchNumber?: string; nftId?: number | string };
      toast.info('Yêu cầu chuyển lô thuốc mới', {
        description: `Lô thuốc #${d.batchNumber || d.nftId} đang chờ xác nhận`,
        duration: 6000,
      });
    },
    onTransferRequestApproved: (data: unknown) => {
      const d = data as { batchNumber?: string; nftId?: number | string };
      toast.success('Yêu cầu chuyển lô đã được duyệt', {
        description: `Lô thuốc #${d.batchNumber || d.nftId} đã được xác nhận`,
        duration: 6000,
      });
    },
    onTransferRequestRejected: (data: unknown) => {
      const d = data as { batchNumber?: string; nftId?: number | string };
      toast.error('Yêu cầu chuyển lô bị từ chối', {
        description: `Lô thuốc #${d.batchNumber || d.nftId} không được chấp nhận`,
        duration: 6000,
      });
    },
    onNFTMinted: (data: unknown) => {
      const d = data as { batchNumber?: string };
      toast.success('NFT đã được mint thành công', {
        description: `Lô thuốc #${d.batchNumber}`,
        duration: 5000,
      });
    },
    onNFTTransferred: (data: unknown) => {
      const d = data as { objectId?: string; batchNumber?: string };
      toast.info('Thuốc đã được chuyển giao', {
        description: `Lô #${d.batchNumber || d.objectId}`,
        duration: 5000,
      });
    },
    onMilestoneAdded: (data: unknown) => {
      const d = data as { type?: string; batchNumber?: string };
      toast.info('Cột mốc mới', {
        description: `${d.type || 'Cập nhật'} cho lô thuốc #${d.batchNumber}`,
        duration: 4000,
      });
    },
  });

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 w-80 bg-white rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto border">
          <div className="p-3 border-b bg-gray-50 rounded-t-lg">
            <h2 className="font-semibold text-gray-800">Thông báo</h2>
            <p className="text-xs text-gray-500">Cập nhật thời gian thực</p>
          </div>
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p className="text-sm">Không có thông báo</p>
            </div>
          ) : (
            notifications.map(notification => (
              <div
                key={notification.id}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                  notification.read ? 'opacity-60' : 'bg-blue-50'
                }`}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex items-start gap-2">
                  <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                    notification.type === 'success' ? 'bg-green-500'
                    : notification.type === 'error' ? 'bg-red-500'
                    : notification.type === 'warning' ? 'bg-yellow-500'
                    : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 text-sm">{notification.title}</h3>
                    <p className="text-xs text-gray-600 mt-0.5">{notification.message}</p>
                    <span className="text-xs text-gray-400 mt-1 block">
                      {new Date(notification.timestamp).toLocaleString('vi-VN')}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
