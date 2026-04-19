import { NextResponse } from "next/server";
import { backupService, type SystemBackup } from "@/lib/services/backup.service";
import { adminAuthService } from "@/lib/auth/admin-auth";
import { z } from "zod";
import { logger } from '@/lib/utils/logger';

const restoreSchema = z.object({
  backup: z.object({
    version: z.string().optional(),
    timestamp: z.string().optional(),
    tables: z.object({
      nfts: z.array(z.any()).optional(),
      users: z.array(z.any()).optional(),
      milestones: z.array(z.any()).optional(),
      transfer_requests: z.array(z.any()).optional(),
      transfer_requests_v2: z.array(z.any()).optional(),
      notifications: z.array(z.any()).optional(),
      quality_alerts: z.array(z.any()).optional(),
    }),
    stats: z.any().optional(),
  }),
});

export async function POST(request: Request) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token || !(await adminAuthService.verifyAccessToken(token))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = restoreSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid backup format", details: validated.error.errors },
        { status: 400 }
      );
    }

    const backup = validated.data.backup as SystemBackup;
    const result = await backupService.restoreFromBackup(backup);

    if (result.errors.length > 0) {
      return NextResponse.json(
        {
          success: true,
          partial: true,
          restored: result.restored,
          errors: result.errors,
          message: `Restored with ${result.errors.length} table errors`,
        },
        { status: 207 }
      );
    }

    return NextResponse.json({
      success: true,
      restored: result.restored,
      timestamp: backup.timestamp,
      message: "Restore completed successfully",
    });
  } catch (error: any) {
    logger.error('API_ADMIN', 'POST restore error', error);
    return NextResponse.json(
      { error: `Failed to restore: ${error.message}` },
      { status: 500 }
    );
  }
}
