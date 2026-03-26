/**
 * API Route: POST /api/auth/user/login
 * Đăng nhập user và nhận JWT token
 *
 * Body:
 * - address: Sui wallet address (0x + 64 hex chars)
 * - email: Email (optional)
 * - role: User role (MANUFACTURER, DISTRIBUTOR, PHARMACY, CONSUMER)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createTokenPair } from '@/lib/auth/jwt';
import { pool } from '@/lib/db';
import { z } from 'zod';
import { ensureTableExists, TABLE_DEFINITIONS } from "@/lib/db/table-init";

const VALID_ROLES = ['MANUFACTURER', 'DISTRIBUTOR', 'PHARMACY', 'CONSUMER'] as const;

const loginSchema = z.object({
  address: z.string()
    .min(1, 'Address là bắt buộc')
    .regex(/^0x[a-fA-F0-9]{64}$/, 'Địa chỉ Sui không hợp lệ'),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  role: z.enum(VALID_ROLES, {
    errorMap: () => ({ message: 'Role phải là một trong: MANUFACTURER, DISTRIBUTOR, PHARMACY, CONSUMER' }),
  }),
});

export async function POST(req: NextRequest) {
  try {
    // Validate request
    const body = await req.json();
    const validatedData = loginSchema.parse(body);

    const address = validatedData.address.toLowerCase();

    // Ensure users table exists
    await ensureTableExists("users", TABLE_DEFINITIONS.users);

    // Kiểm tra hoặc tạo user trong database
    let user = await getUserByAddress(address);

    if (!user) {
      // Tạo user mới
      user = await createUser({
        address,
        email: validatedData.email,
        role: validatedData.role,
      });
    } else {
      // Cập nhật role nếu cần
      if (validatedData.role !== user.role) {
        user = await updateUserRole(address, validatedData.role);
      }
    }

    // Tạo JWT tokens (use address as userId fallback)
    const tokenPair = await createTokenPair({
      userId: user.address, // Use address as ID fallback
      address: user.address,
      role: user.role,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Đăng nhập thành công',
        data: {
          user: {
            address: user.address,
            role: user.role,
          },
          tokens: {
            accessToken: tokenPair.accessToken,
            refreshToken: tokenPair.refreshToken,
            expiresIn: tokenPair.expiresIn,
          },
        },
      },
      {
        status: 200,
        headers: {
          'Set-Cookie': `refreshToken=${tokenPair.refreshToken}; Path=/; HttpOnly; Secure; SameSite=Strict`,
        },
      }
    );
  }catch (error: any) {
    console.error('[LoginAPI] Error:', error);

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
        error: error.message || 'Lỗi khi đăng nhập',
      },
      { status: 500 }
    );
  }
}

/**
 * Lấy user theo address
 */
async function getUserByAddress(address: string) {
  try {
    // Try to get user - fallback to safe columns
    let result;
    try {
      result = await pool.query(
        'SELECT address, role, assigned_at, updated_at, created_at FROM users WHERE address = $1 LIMIT 1',
        [address]
      );
    } catch (colError: any) {
      console.log('[LoginAPI] Column error, trying basic query:', colError.message);
      result = await pool.query(
        'SELECT address, role FROM users WHERE address = $1 LIMIT 1',
        [address]
      );
    }
    return result.rows[0] || null;
  }catch (error) {
    console.error('[LoginAPI] Error getting user:', error);
    return null;
  }
}

/**
 * Tạo user mới
 * Note: email, id columns may not exist in older schemas
 */
async function createUser(data: {
  address: string;
  email?: string;
  role: string;
}) {
  try {
    // Simple insert - use only basic columns
    let result;
    try {
      result = await pool.query(
        `INSERT INTO users (address, role, assigned_at)
         VALUES ($1, $2, NOW())
         RETURNING address, role, assigned_at`,
        [data.address, data.role]
      );
    } catch (colError: any) {
      console.log('[LoginAPI] Column error, trying alternative:', colError.message);
      // Fallback for older schema
      result = await pool.query(
        `INSERT INTO users (address, role)
         VALUES ($1, $2)
         RETURNING address, role`,
        [data.address, data.role]
      );
    }
    return result.rows[0];
  }catch (error) {
    console.error('[LoginAPI] Error creating user:', error);
    throw error;
  }
}

/**
 * Cập nhật role của user
 */
async function updateUserRole(address: string, role: string) {
  try {
    let result;
    try {
      result = await pool.query(
        `UPDATE users SET role = $1, updated_at = NOW()
         WHERE address = $2
         RETURNING address, role`,
        [role, address]
      );
    } catch (colError: any) {
      console.log('[LoginAPI] Column error in update:', colError.message);
      await pool.query(
        `UPDATE users SET role = $1
         WHERE address = $2`,
        [role, address]
      );
      result = await pool.query(
        'SELECT address, role FROM users WHERE address = $1 LIMIT 1',
        [address]
      );
    }
    return result.rows[0];
  }catch (error) {
    console.error('[LoginAPI] Error updating user role:', error);
    throw error;
  }
}
