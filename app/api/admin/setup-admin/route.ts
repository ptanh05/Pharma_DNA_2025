/**
 * POST /api/admin/setup-admin
 * Setup ADMIN role for OWNER_PRIVATE_KEY address
 * This should be called once after deploying the contract
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuthService } from "@/lib/auth/admin-auth";
import { getRole, assignRole } from '@/lib/blockchain/contract-sui';
import { Role } from '@/lib/blockchain/types-sui';
import { parsePrivateKey } from '@/lib/blockchain/contract-sui';
import { getExplorerTxUrl } from '@/lib/blockchain/contract';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

export async function POST(req: NextRequest) {
  // Require admin authentication
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (!token || !(await adminAuthService.verifyAccessToken(token))) {
    return NextResponse.json({ error: "Yêu cầu quyền admin" }, { status: 401 });
  }

  try {
    if (!OWNER_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'OWNER_PRIVATE_KEY chưa được cấu hình' },
        { status: 500 }
      );
    }

    // Get owner address
    const keypair = parsePrivateKey(OWNER_PRIVATE_KEY);
    const ownerAddress = keypair.toSuiAddress();

    logger.info('API_ADMIN', `Owner address: ${ownerAddress}`);

    // Check current role
    const currentRole = await getRole(ownerAddress);
    logger.info('API_ADMIN', `Current role: ${currentRole} (${Role[currentRole] || 'NONE'})`);

    if (currentRole === Role.ADMIN) {
      return NextResponse.json({
        success: true,
        message: `✅ Owner address đã có ADMIN role`,
        address: ownerAddress,
        role: 'ADMIN',
      });
    }

    // Try to assign ADMIN role
    // This will only work if the owner is the deployer (who automatically gets ADMIN during init)
    // But if deployer hasn't been assigned ADMIN yet, we can try
    logger.info('API_ADMIN', 'Attempting to assign ADMIN role...');
    
    // Note: This is tricky - we need an admin to assign admin role
    // If this is the deployer, it should already have ADMIN role from init
    // If not, we need another admin to assign it
    
    // For now, we'll try to assign it (will fail if not deployer)
    const result = await assignRole(ownerAddress, Role.ADMIN, OWNER_PRIVATE_KEY);

    if (result.success) {
      // Verify after a delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      const newRole = await getRole(ownerAddress);

      return NextResponse.json({
        success: true,
        message: `✅ Đã assign ADMIN role cho owner address thành công!`,
        address: ownerAddress,
        transactionDigest: result.digest,
        explorerUrl: getExplorerTxUrl(result.digest),
        verified: newRole === Role.ADMIN,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Không thể assign ADMIN role',
        detail: result.error,
        hint: 'Nếu OWNER_PRIVATE_KEY không phải là deployer address, bạn cần dùng deployer address để assign ADMIN role cho OWNER_PRIVATE_KEY address.',
      }, { status: 400 });
    }
  } catch (error: any) {
    logger.error('API_ADMIN', 'setup-admin error', error);
    return NextResponse.json(
      { error: 'Lỗi khi setup ADMIN role', detail: error.message },
      { status: 500 }
    );
  }
}

