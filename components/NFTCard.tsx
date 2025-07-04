"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Package, User } from "lucide-react"
import StatusBadge from "./StatusBadge"

interface NFTCardProps {
  tokenId: string
  drugName: string
  batchNumber: string
  expiryDate: string
  status: string
  manufacturer?: string
  onClick?: () => void
}

export default function NFTCard({
  tokenId,
  drugName,
  batchNumber,
  expiryDate,
  status,
  manufacturer,
  onClick,
}: NFTCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${onClick ? "hover:border-blue-300" : ""}`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{drugName}</CardTitle>
            <CardDescription>Token ID: #{tokenId}</CardDescription>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center text-sm text-gray-600">
          <Package className="w-4 h-4 mr-2" />
          <span>Lô: {batchNumber}</span>
        </div>

        <div className="flex items-center text-sm text-gray-600">
          <Calendar className="w-4 h-4 mr-2" />
          <span>HSD: {expiryDate}</span>
        </div>

        {manufacturer && (
          <div className="flex items-center text-sm text-gray-600">
            <User className="w-4 h-4 mr-2" />
            <span className="font-mono text-xs">{manufacturer}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
