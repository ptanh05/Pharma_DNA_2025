import { NextResponse } from "next/server";
import { backupService } from "@/lib/services/backup.service";
import { adminAuthService } from "@/lib/auth/admin-auth";

export async function GET(request: Request) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token || !adminAuthService.verifyToken(token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";

    if (format === "csv") {
      const csv = await backupService.exportNFTsCSV();
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="nfts-export-${Date.now()}.csv"`,
        },
      });
    }

    const backup = await backupService.generateBackup();
    return NextResponse.json(backup);
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 });
  }
}
