"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2, ExternalLink } from "lucide-react";
import { useState } from "react";

interface ConfirmTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  title: string;
  description: string;
  details?: {
    label: string;
    value: string;
  }[];
  type: "mint" | "transfer";
  estimatedGas?: string;
}

export default function ConfirmTransactionDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  details = [],
  type,
  estimatedGas,
}: ConfirmTransactionDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra khi xử lý transaction");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-yellow-500" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction Details */}
          {details.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <h4 className="font-semibold text-sm text-gray-700 mb-2">
                Chi tiết transaction:
              </h4>
              {details.map((detail, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-600">{detail.label}:</span>
                  <span className="font-mono text-xs font-medium">
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Gas Fee Estimate */}
          {estimatedGas && (
            <Alert className="bg-blue-50 text-blue-800 border-blue-200">
              <AlertDescription>
                <strong>Phí ước tính:</strong> {estimatedGas} SUI
              </AlertDescription>
            </Alert>
          )}

          {/* Warning */}
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              {type === "mint"
                ? "Bạn sẽ ký transaction để mint NFT trên blockchain. Transaction này không thể hoàn tác."
                : "Bạn sẽ ký transaction để chuyển quyền sở hữu NFT. Transaction này không thể hoàn tác."}
            </AlertDescription>
          </Alert>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Processing State */}
          {isProcessing && (
            <Alert className="bg-blue-50 text-blue-800 border-blue-200">
              <AlertDescription className="flex items-center">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Đang chờ bạn ký transaction trong wallet extension...
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Hủy
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing}
            className={
              type === "mint"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-green-600 hover:bg-green-700"
            }
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              "Xác nhận và ký"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

