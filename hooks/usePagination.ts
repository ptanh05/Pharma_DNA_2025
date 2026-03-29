"use client";

import { useState, useMemo, useEffect } from "react";

export interface UsePaginationOptions<T> {
  items: T[] | null | undefined;
  itemsPerPage?: number;
  initialPage?: number;
}

export interface UsePaginationReturn<T> {
  currentItems: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  setItemsPerPage: (itemsPerPage: number) => void;
}

/**
 * Hook for pagination
 */
export function usePagination<T>({
  items,
  itemsPerPage = 10,
  initialPage = 1,
}: UsePaginationOptions<T>): UsePaginationReturn<T> {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [perPage, setPerPage] = useState(itemsPerPage);

  // Defensive: normalize to array
  const safeItems = Array.isArray(items) ? items : [];

  const totalPages = Math.max(1, Math.ceil(safeItems.length / perPage));
  const totalItems = safeItems.length;

  const currentItems = useMemo(() => {
    const startIndex = (currentPage - 1) * perPage;
    const endIndex = startIndex + perPage;
    return safeItems.slice(startIndex, endIndex);
  }, [items, currentPage, perPage]);

  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const previousPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  // Reset to page 1 when items change
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  return {
    currentItems,
    currentPage,
    totalPages,
    totalItems,
    goToPage,
    nextPage,
    previousPage,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    setItemsPerPage: (newPerPage: number) => {
      setPerPage(newPerPage);
      setCurrentPage(1); // Reset to first page
    },
  };
}

