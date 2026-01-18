"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Filter } from "lucide-react";
import { useState } from "react";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  status?: {
    label: string;
    options: FilterOption[];
  };
  dateRange?: {
    label: string;
  };
  sortBy?: {
    label: string;
    options: FilterOption[];
  };
}

interface FilterBarProps {
  filters: FilterConfig;
  onFilterChange: (filters: Record<string, string>) => void;
  onSortChange?: (sortBy: string, sortOrder: "asc" | "desc") => void;
  className?: string;
}

export default function FilterBar({
  filters,
  onFilterChange,
  onSortChange,
  className = "",
}: FilterBarProps) {
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...selectedFilters, [key]: value };
    setSelectedFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleRemoveFilter = (key: string) => {
    const newFilters = { ...selectedFilters };
    delete newFilters[key];
    setSelectedFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleSortChange = (newSortBy: string) => {
    setSortBy(newSortBy);
    if (onSortChange) {
      onSortChange(newSortBy, sortOrder);
    }
  };

  const handleSortOrderChange = (newOrder: "asc" | "desc") => {
    setSortOrder(newOrder);
    if (onSortChange && sortBy) {
      onSortChange(sortBy, newOrder);
    }
  };

  const activeFiltersCount = Object.keys(selectedFilters).length;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status Filter */}
        {filters.status && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{filters.status.label}:</span>
            <Select
              value={selectedFilters.status || "all"}
              onValueChange={(value) =>
                handleFilterChange("status", value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {filters.status.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Sort By */}
        {filters.sortBy && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Sắp xếp:</span>
            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Chọn..." />
              </SelectTrigger>
              <SelectContent>
                {filters.sortBy.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sortBy && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleSortOrderChange(sortOrder === "asc" ? "desc" : "asc")
                }
              >
                {sortOrder === "asc" ? "↑" : "↓"}
              </Button>
            )}
          </div>
        )}

        {/* Clear Filters */}
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedFilters({});
              setSortBy("");
              onFilterChange({});
            }}
          >
            <X className="w-4 h-4 mr-1" />
            Xóa bộ lọc ({activeFiltersCount})
          </Button>
        )}
      </div>

      {/* Active Filters Badges */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-500" />
          {Object.entries(selectedFilters).map(([key, value]) => {
            const option = filters.status?.options.find((o) => o.value === value);
            return (
              <Badge
                key={key}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {option?.label || value}
                <X
                  className="w-3 h-3 cursor-pointer"
                  onClick={() => handleRemoveFilter(key)}
                />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

