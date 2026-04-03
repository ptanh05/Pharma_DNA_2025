import { NextResponse } from "next/server";
import { backupService } from "@/lib/services/backup.service";
import { adminAuthService } from "@/lib/auth/admin-auth";

export async function GET(request: Request) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token || !adminAuthService.verifyToken(token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const backup = await backupService.generateBackup();
    return NextResponse.json(backup);
  } catch (error) {
    console.error("Backup error:", error);
    return NextResponse.json({ error: "Failed to generate backup" }, { status: 500 });
  }
}
