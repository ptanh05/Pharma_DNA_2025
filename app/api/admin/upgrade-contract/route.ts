/**
 * API Route: POST /api/admin/upgrade-contract
 * Admin khởi tạo nâng cấp smart contract
 *
 * Headers: Authorization: Bearer <JWT_TOKEN>
 * Body: {
 *   newVersion: string,
 *   migrationScript: string (base64 encoded),
 *   description?: string
 * }
 */

import { NextRequest, NextResponse }from 'next/server';
import { authorizeRole, UnauthorizedError, ForbiddenError }from '@/lib/middleware/auth';
import { pool } from "@/lib/db";
import { logInfo, logError, logSecurityEvent, logEvent }from '@/lib/logger';
import { z }from 'zod';
import { v4 as uuidv4 }from 'uuid';

// Validation schema
const upgradeSchema = z.object({
  newVersion: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version phải là format X.Y.Z'),
  migrationScript: z.string().min(1, 'migrationScript là bắt buộc'),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    // Bước 1: Xác thực user (ADMIN)
    let user;
    try {
      user = await authorizeRole(req, 'ADMIN');
    }catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          { error: 'Bạn phải đăng nhập để tiếp tục' },
          { status: 401 }
        );
      }
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          { error: 'Chỉ Admin mới có thể upgrade contract' },
          { status: 403 }
        );
      }
      throw error;
    }

    // Bước 2: Validate request
    const body = await req.json();
    const validatedData = upgradeSchema.parse(body);

    // Bước 3: Kiểm tra version hiện tại
    const currentVersionQuery = `
      SELECT version, deployed_at
      FROM contract_versions
      ORDER BY deployed_at DESC
      LIMIT 1
    `;
    const currentVersionResult = await pool.query(currentVersionQuery);
    const currentVersion = currentVersionResult.rows[0];

    if (!currentVersion) {
      return NextResponse.json(
        { error: 'Không tìm thấy version hiện tại' },
        { status: 400 }
      );
    }

    // Bước 4: Validate version mới > version cũ
    const [currentMajor, currentMinor, currentPatch] = currentVersion.version.split('.').map(Number);
    const [newMajor, newMinor, newPatch] = validatedData.newVersion.split('.').map(Number);

    if (
      newMajor < currentMajor ||
      (newMajor === currentMajor && newMinor < currentMinor) ||
      (newMajor === currentMajor && newMinor === currentMinor && newPatch <= currentPatch)
    ) {
      return NextResponse.json(
        { error: 'Version mới phải lớn hơn version hiện tại' },
        { status: 400 }
      );
    }

    // Bước 5: Tạo upgrade record
    const upgradId = uuidv4();
    const now = new Date().toISOString();

    const insertQuery = `
      INSERT INTO contract_upgrades (
        id,
        from_version,
        to_version,
        migration_script,
        description,
        admin_address,
        status,
        created_at,
        initiated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const insertResult = await pool.query(insertQuery, [
      upgradId,
      currentVersion.version,
      validatedData.newVersion,
      validatedData.migrationScript,
      validatedData.description || null,
      user.address.toLowerCase(),
      'pending',
      now,
      user.userId,
    ]);

    const upgradeRecord = insertResult.rows[0];

    // Bước 6: Log security event
    logSecurityEvent({
      requestId,
      event: 'CONTRACT_UPGRADE_INITIATED',
      userId: user.userId,
      action: 'UPGRADE',
      resource: `contract:${validatedData.newVersion}`,
      result: 'allowed',
    });

    // Log business event
    logEvent({
      requestId,
      event: 'CONTRACT_UPGRADE_INITIATED',
      userId: user.userId,
      role: 'ADMIN',
      details: {
        fromVersion: currentVersion.version,
        toVersion: validatedData.newVersion,
        upgradId,
      },
      severity: 'critical',
    });

    logInfo('Contract upgrade initiated', {
      requestId,
      upgradId,
      fromVersion: currentVersion.version,
      toVersion: validatedData.newVersion,
      admin: user.address,
      timestamp: now,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Nâng cấp contract đã được khởi tạo',
        data: {
          upgrade: upgradeRecord,
          nextSteps: [
            'Chạy migration script trên testnet',
            'Xác thực kết quả migration',
            'Deploy lên mainnet',
            'Xác nhận upgrade',
          ],
        },
      },
      { status: 201 }
    );

  }catch (error: any) {
    logError('Upgrade contract endpoint error', error, { requestId });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Lỗi khi nâng cấp contract',
      },
      { status: 500 }
    );
  }
}
