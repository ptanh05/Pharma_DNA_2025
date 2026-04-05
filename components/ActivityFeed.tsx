"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, RefreshCw, Clock } from "lucide-react";
import { formatDistanceToNow, format, parseISO, isValid } from "date-fns";
import { vi } from "date-fns/locale";

interface ActivityItem {
  id: number;
  type: string;
  description: string;
  timestamp: string;
  location?: string;
  actor_address?: string;
  nft_id?: number;
}

interface ActivityFeedProps {
  role: "manufacturer" | "distributor" | "pharmacy";
  className?: string;
  maxItems?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function ActivityFeed({
  role,
  className = "",
  maxItems = 10,
  autoRefresh = false,
  refreshInterval = 30000,
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/activity?limit=${maxItems}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Handle both { success: true, data: { activity: [...] } } and { data: [...] } formats
      const activityList = data?.data?.activity ?? data?.data ?? data?.activity ?? [];
      setActivities(Array.isArray(activityList) ? activityList : []);
    } catch (err: any) {
      console.error("Failed to fetch activities:", err);
      setError("Không thể tải hoạt động");
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch on client side
    if (typeof window === 'undefined') return;
    fetchActivities();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, maxItems]);

  useEffect(() => {
    if (!autoRefresh || typeof window === 'undefined') return;
    const interval = setInterval(fetchActivities, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const getActivityIcon = (type: string) => {
    const lowerType = type?.toLowerCase() || "";
    if (lowerType.includes("tạo") || lowerType.includes("create") || lowerType.includes("mint"))
      return "🧪";
    if (lowerType.includes("chuyển") || lowerType.includes("transfer"))
      return "🚚";
    if (lowerType.includes("nhận") || lowerType.includes("receive"))
      return "📦";
    if (lowerType.includes("xác nhận") || lowerType.includes("confirm"))
      return "✅";
    if (lowerType.includes("kho") || lowerType.includes("warehouse"))
      return "🏥";
    if (lowerType.includes("vận chuyển") || lowerType.includes("transit"))
      return "🚛";
    return "📋";
  };

  const getActivityColor = (type: string) => {
    const lowerType = type?.toLowerCase() || "";
    if (lowerType.includes("tạo") || lowerType.includes("create") || lowerType.includes("mint"))
      return "bg-blue-100 text-blue-800";
    if (lowerType.includes("chuyển") || lowerType.includes("transfer"))
      return "bg-purple-100 text-purple-800";
    if (lowerType.includes("nhận") || lowerType.includes("receive"))
      return "bg-green-100 text-green-800";
    if (lowerType.includes("xác nhận") || lowerType.includes("confirm"))
      return "bg-emerald-100 text-emerald-800";
    if (lowerType.includes("lỗi") || lowerType.includes("error"))
      return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-base">
          <Activity className="w-5 h-5 mr-2 text-blue-600" />
          Hoạt động gần đây
          <button
            type="button"
            title="Làm mới hoạt động"
            aria-label="Làm mới hoạt động"
            onClick={fetchActivities}
            disabled={isLoading}
            className="ml-auto p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{error}</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Chưa có hoạt động nào</p>
          </div>
        ) : (
          <div className="divide-y">
            {activities.map((activity) => (
              <div key={activity.id} className="px-4 py-3 hover:bg-gray-50 transition-colors animate-fade-in-up">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-lg">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getActivityColor(activity.type)}`}>
                        {activity.type}
                      </span>
                      {activity.nft_id && (
                        <span className="text-xs text-gray-500 font-mono">#{activity.nft_id}</span>
                      )}
                    </div>
                    {activity.description && (
                      <p className="text-sm text-gray-700 mt-1 line-clamp-2">{activity.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {(() => {
                          if (!activity.timestamp) return "N/A";
                          const date = parseISO(activity.timestamp);
                          if (!isValid(date)) return "N/A";
                          const ago = formatDistanceToNow(date, { addSuffix: true, locale: vi });
                          const full = format(date, "dd/MM/yyyy HH:mm", { locale: vi });
                          return `${ago} · ${full}`;
                        })()}
                      </span>
                      {activity.location && (
                        <span className="truncate max-w-[150px]">📍 {activity.location}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ActivityFeed;
