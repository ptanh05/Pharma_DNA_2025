"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";

export default function NotificationBadge() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  } = useNotifications();

  const unreadNotifications = notifications.filter((n) => !n.read);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <h4 className="font-semibold text-sm">Thông báo</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-7 text-xs"
            >
              Đánh dấu đã đọc
            </Button>
          )}
        </div>

        <ScrollArea className="h-96">
          {notifications.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-gray-500">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Chưa có thông báo nào</p>
            </div>
          ) : (
            <div className="py-1">
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className="flex flex-col items-start p-3 cursor-pointer"
                  onClick={() => {
                    if (!notification.read) {
                      markAsRead(notification.id);
                    }
                    // Handle notification click (navigate, show details, etc.)
                    if (notification.type === "transfer-request:created") {
                      toast.info("Mở trang yêu cầu chuyển lô", {
                        description: "Đang chuyển đến trang quản lý yêu cầu...",
                      });
                    }
                  }}
                >
                  <div className="flex items-start justify-between w-full mb-1">
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${
                          !notification.read ? "text-gray-900" : "text-gray-600"
                        }`}
                      >
                        {notification.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {notification.message}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full ml-2 mt-1" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDistanceToNow(new Date(notification.timestamp), {
                      addSuffix: true,
                    })}
                  </p>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={clearNotifications}
              className="text-red-600"
            >
              Xóa tất cả
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

