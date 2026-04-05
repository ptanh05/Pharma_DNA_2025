"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Grid3X3 } from "lucide-react";

const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  if (i === 0) return "00h";
  if (i === 12) return "12h";
  if (i === 23) return "23h";
  return "";
});

function getHeatColor(value: number, max: number): string {
  if (max === 0 || value === 0) return "bg-gray-100";
  const intensity = value / max;
  if (intensity >= 0.75) return "bg-green-600";
  if (intensity >= 0.5) return "bg-green-400";
  if (intensity >= 0.25) return "bg-green-300";
  if (intensity >= 0.1) return "bg-green-200";
  return "bg-green-100";
}

interface HeatmapData {
  heatmap: { [key: number]: { [key: number]: number } };
  maxCount: number;
  days: number;
}

export function ActivityHeatmap() {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number; count: number } | null>(null);

  const fetchHeatmap = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/dashboard/heatmap?days=30");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (error) {
      console.error("Heatmap error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHeatmap();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center">
          <Grid3X3 className="w-4 h-4 mr-2 text-blue-600" />
          Activity Heatmap
        </CardTitle>
        <CardDescription>
          Mật độ hoạt động theo ngày trong tuần và giờ trong ngày (30 ngày)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : !data ? (
          <div className="h-[200px] flex items-center justify-center text-gray-400">
            <p className="text-sm">Không có dữ liệu</p>
          </div>
        ) : (
          <>
            {/* Heatmap grid */}
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Hour labels (top) */}
                <div className="flex mb-1">
                  <div className="w-8 flex-shrink-0" />
                  {HOUR_LABELS.map((label, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 text-center text-[9px] text-gray-400",
                        label ? "text-gray-600 font-medium" : ""
                      )}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                {/* Grid rows */}
                {DAY_LABELS.map((dayLabel, dow) => (
                  <div key={dow} className="flex items-center mb-1">
                    <div className="w-8 flex-shrink-0 text-xs text-gray-600 font-medium text-right pr-1">
                      {dayLabel}
                    </div>
                    <div className="flex-1 flex gap-[2px]">
                      {Array.from({ length: 24 }, (_, hr) => {
                        const count = data.heatmap[dow]?.[hr] ?? 0;
                        const isHovered =
                          hoveredCell?.day === dow && hoveredCell?.hour === hr;
                        return (
                          <div
                            key={hr}
                            className={cn(
                              "flex-1 h-5 rounded-[2px] cursor-pointer transition-all",
                              getHeatColor(count, data.maxCount),
                              isHovered ? "ring-2 ring-blue-500 ring-offset-1 scale-110 z-10" : ""
                            )}
                            onMouseEnter={() =>
                              setHoveredCell({ day: dow, hour: hr, count })
                            }
                            onMouseLeave={() => setHoveredCell(null)}
                            title={`${DAY_LABELS[dow]} ${hr}:00 - ${count} hoạt động`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tooltip */}
            {hoveredCell && (
              <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded px-3 py-2 border">
                <span className="font-medium">{DAY_LABELS[hoveredCell.day]}</span>{" "}
                lúc <span className="font-medium">{hoveredCell.hour.toString().padStart(2, "0")}:00</span> —{" "}
                <span className="font-semibold">{hoveredCell.count} hoạt động</span>
              </div>
            )}

            {/* Legend */}
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <span>Ít</span>
              <div className="flex gap-[2px]">
                {["bg-green-100", "bg-green-200", "bg-green-300", "bg-green-400", "bg-green-600"].map(
                  (cls, i) => (
                    <div key={i} className={cn("w-5 h-4 rounded-[2px]", cls)} />
                  )
                )}
              </div>
              <span>Nhiều</span>
              <span className="ml-auto text-gray-400">
                Max: {data.maxCount} hoạt động
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default ActivityHeatmap;
