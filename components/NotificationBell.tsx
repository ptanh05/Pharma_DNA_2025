'use client';

import { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';

/**
 * Notification Bell Component
 */
export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
  const { notifications, unreadCount, markAsRead } = useNotifications(10000);

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
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
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 w-80 bg-white rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              Không có thông báo
            </div>
          ) : (
            notifications.map(notification => (
              <div
                key={notification.id}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                  notification.read ? 'opacity-60' : 'bg-blue-50'
                }`}
                onClick={() => markAsRead(notification.id)}
              >
                <h3 className="font-semibold text-gray-800">{notification.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                <span className="text-xs text-gray-400 mt-2 block">
                  {new Date(notification.timestamp).toLocaleString('vi-VN')}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
