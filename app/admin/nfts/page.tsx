"use client";

import { useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { useNFTsPaginated } from "@/hooks/useNFTs";
import Pagination from "@/components/Pagination";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  Filter,
  ArrowLeft,
  ArrowRight,
  LayoutDashboard,
  Package as PackageIcon,
} from "lucide-react";

function AdminNFTsContent() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useNFTsPaginated(page, limit);

  const filteredNFTs = (() => {
    if (!data?.nfts) return [];
    if (statusFilter === "all") return data.nfts;
    return data.nfts.filter((nft: any) => {
      if (statusFilter === "minted") return nft.status === "minted";
      if (statusFilter === "in_transit") return nft.status === "at_distributor";
      if (statusFilter === "at_pharmacy") return nft.status === "at_pharmacy";
      return true;
    });
  })();

  const totalPages = Math.ceil((data?.total || 0) / limit);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Quay lại Dashboard
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Danh sách lô thuốc (NFT)</h1>
          <p className="text-sm text-gray-500">
            Tất cả NFT trong hệ thống · {data?.total || 0} lô thuốc
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <CardTitle className="text-base md:text-lg">Danh sách lô thuốc (NFT)</CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Tất cả NFT trong hệ thống
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 md:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="minted">Đã mint</SelectItem>
                  <SelectItem value="in_transit">Đang vận chuyển</SelectItem>
                  <SelectItem value="at_pharmacy">Tại nhà thuốc</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          ) : filteredNFTs.length > 0 ? (
            <>
              {/* Desktop list */}
              <div className="hidden md:block space-y-3">
                {filteredNFTs.map((nft: any, i: number) => (
                  <div
                    key={nft.id}
                    className="flex items-center justify-between p-3 md:p-4 border rounded-lg hover:bg-gray-50 animate-fade-in-up"
                    style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-1 md:mb-2">
                        <Package className="w-5 h-5 text-blue-500" />
                        <span className="font-medium text-sm md:text-base">
                          {nft.product_name || nft.batch_number}
                        </span>
                        <Badge
                          className={`text-xs ${
                            nft.status === "minted"
                              ? "bg-blue-100 text-blue-800"
                              : nft.status === "at_distributor"
                              ? "bg-yellow-100 text-yellow-800"
                              : nft.status === "at_pharmacy"
                              ? "bg-green-100 text-green-800"
                              : nft.status === "dispensed"
                              ? "bg-gray-100 text-gray-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {nft.status || "unknown"}
                        </Badge>
                      </div>
                      <p className="text-xs md:text-sm text-gray-500">
                        <code className="text-xs bg-gray-100 px-1 rounded">{nft.batch_number}</code>
                        {nft.manufacturer_address && (
                          <span className="ml-2">
                            MFG: {nft.manufacturer_address.slice(0, 8)}...
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        Created: {new Date(nft.created_at).toLocaleString("vi-VN")}
                      </p>
                    </div>
                    <Link href={`/admin/nfts/${nft.id}`}>
                      <Button variant="ghost" size="sm" className="text-blue-600">
                        Chi tiết <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {filteredNFTs.map((nft: any) => (
                  <div key={nft.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-sm">{nft.product_name || nft.batch_number}</div>
                        <div className="text-xs text-gray-500">{nft.batch_number}</div>
                      </div>
                      <Badge
                        className={`text-xs ${
                          nft.status === "minted"
                            ? "bg-blue-100 text-blue-800"
                            : nft.status === "at_distributor"
                            ? "bg-yellow-100 text-yellow-800"
                            : nft.status === "at_pharmacy"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {nft.status || "unknown"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={data?.total || 0}
                  itemsPerPage={limit}
                  onPageChange={(p) => setPage(p)}
                  onItemsPerPageChange={(l) => { setLimit(l); setPage(1); }}
                  itemsPerPageOptions={[12, 24, 48]}
                />
              )}
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Chưa có NFT nào trong hệ thống</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminNFTsPage() {
  return (
    <AdminGuard>
      <AdminNFTsContent />
    </AdminGuard>
  );
}
