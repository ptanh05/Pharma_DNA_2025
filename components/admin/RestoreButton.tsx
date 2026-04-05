"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export default function RestoreButton() {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRestore = async (file: File) => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      toast.error("Vui lòng đăng nhập admin trước");
      return;
    }

    const confirmed = window.confirm(
      `Phục hồi từ file backup?\n\nFile: ${file.name}\n\n⚠️ Dữ liệu hiện tại sẽ được cập nhật theo backup. Các bản ghi trùng sẽ được ghi đè.`
    );
    if (!confirmed) return;

    toast.loading("Đang phục hồi dữ liệu...", { id: "restore" });

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      // Validate backup structure
      if (!backup.tables || typeof backup.tables !== "object") {
        throw new Error("File backup không hợp lệ: thiếu bảng dữ liệu");
      }

      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ backup }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Restore failed");
      }

      // Build result summary
      const lines = Object.entries(data.restored || {})
        .filter(([, count]) => (count as number) > 0)
        .map(([table, count]) => `${table}: ${count} rows`);

      if (data.errors && data.errors.length > 0) {
        toast.warning(
          `Phục hồi một phần (${data.errors.length} lỗi)\n${data.errors.join(", ")}`,
          { id: "restore", duration: 8000 }
        );
      } else {
        toast.success(
          `Phục hồi thành công!\n${lines.join("\n")}`,
          { id: "restore", duration: 6000 }
        );
      }
    } catch (err: any) {
      console.error("Restore error:", err);
      toast.error(`Phục hồi thất bại: ${err.message}`, {
        id: "restore",
        duration: 6000,
      });
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleRestore(file);
            e.target.value = ""; // Reset for next selection
          }
        }}
      />
      <Button
        variant="outline"
        className="w-full bg-transparent justify-start"
        size="sm"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="w-4 h-4 mr-2 text-green-600" />
        Phục hồi dữ liệu
      </Button>
    </>
  );
}
