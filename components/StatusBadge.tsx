import { Badge } from "@/components/ui/badge"

interface StatusBadgeProps {
  status: string
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "manufactured":
        return {
          label: "Đã sản xuất",
          variant: "secondary" as const,
          className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
        }
      case "in_transit":
        return {
          label: "Đang vận chuyển",
          variant: "secondary" as const,
          className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
        }
      case "received":
        return {
          label: "Đã nhận",
          variant: "secondary" as const,
          className: "bg-green-100 text-green-800 hover:bg-green-100",
        }
      case "in_pharmacy":
        return {
          label: "Tại nhà thuốc",
          variant: "secondary" as const,
          className: "bg-purple-100 text-purple-800 hover:bg-purple-100",
        }
      case "authentic":
        return {
          label: "Chính hãng",
          variant: "secondary" as const,
          className: "bg-green-100 text-green-800 hover:bg-green-100",
        }
      case "warning":
        return {
          label: "Cảnh báo",
          variant: "destructive" as const,
          className: "bg-red-100 text-red-800 hover:bg-red-100",
        }
      case "not_found":
        return {
          label: "Không tìm thấy",
          variant: "destructive" as const,
          className: "bg-gray-100 text-gray-800 hover:bg-gray-100",
        }
      default:
        return {
          label: "Không xác định",
          variant: "outline" as const,
          className: "bg-gray-100 text-gray-800 hover:bg-gray-100",
        }
    }
  }

  const config = getStatusConfig(status)

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}
