/**
 * API Route: GET /api/v1/auth/user/me
 * Lấy thông tin user hiện tại dựa trên wallet address
 *
 * Query Params:
 * - address: Sui wallet address (0x + 64 hex chars)
 */

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { z } from "zod";

const addressSchema = z.object({
  address: z.string()
    .min(1, 'Address là bắt buộc')
    .regex(/^0x[a-fA-F0-9]{64}$/, 'Địa chỉ Sui không hợp lệ'),
});

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Lấy address từ query params
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");

    // Validate address
    const validationResult = addressSchema.safeParse({ address });
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: validationResult.error.errors[0].message },
        { status: 400 }
      );
    }

    const normalizedAddress = validationResult.data.address.toLowerCase();

    // Query user from database (email column may not exist in older schemas)
    const result = await pool.query(
      "SELECT id, address, role, assigned_at, updated_at, created_at FROM users WHERE address = $1",
      [normalizedAddress]
    );

    const duration = Date.now() - startTime;
    console.log(`[GetUserMe] Query completed in ${duration}ms for address: ${normalizedAddress}`);

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: null,
        message: "User not found in database",
      });
    }

    const user = result.rows[0];

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          address: user.address,
          role: user.role,
          createdAt: user.created_at,
          assignedAt: user.assigned_at,
        },
        role: user.role,
        hasRole: !!user.role,
      },
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[GetUserMe] Error after ${duration}ms:`, {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });

    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
