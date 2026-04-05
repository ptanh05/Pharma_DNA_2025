"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export default function RestoreButton() {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRestore = async (file: File) => {
    const confirmed = window.confirm(
      `Phuc hoi tu file backup?\n\nFile: ${file.name}\n\n⚠️ Du lieu hien tai se duoc cap nhat theo backup. Cac ban ghi trung se duoc ghi de.`
    );
    if (!confirmed) return;

    toast.loading("Dang phuc hoi du lieu...", { id: "restore" });

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      // Validate backup structure
      if (!backup.tables || typeof backup.tables !== "object") {
        throw new Error("File backup khong hop le: thieu bang du lieu");
      }

      const res = await fetch("/api/admin/restore", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
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
          `Phuc hoi mot phan (${data.errors.length} loi)\n${data.errors.join(", ")}`,
          { id: "restore", duration: 8000 }
        );
      } else {
        toast.success(
          `Phuc hoi thanh cong!\n${lines.join("\n")}`,
          { id: "restore", duration: 6000 }
        );
      }
    } catch (err: any) {
      console.error("Restore error:", err);
      toast.error(`Phuc hoi that bai: ${err.message}`, {
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
        Phuc hoi du lieu
      </Button>
    </>
  );
}
