/**
 * API Route: POST /api/v1/auth/user/login
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

    // Tạo JWT tokens
    const tokenPair = await createTokenPair({
      userId: user.id,
      address: user.address,
      role: user.role,
      email: user.email,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Đăng nhập thành công',
        data: {
          user: {
            id: user.id,
            address: user.address,
            email: user.email,
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
    const result = await pool.query(
      'SELECT * FROM users WHERE address = $1 LIMIT 1',
      [address]
    );
    return result.rows[0] || null;
  }catch (error) {
    console.error('[LoginAPI] Error getting user:', error);
    return null;
  }
}

/**
 * Tạo user mới
 */
async function createUser(data: {
  address: string;
  email?: string;
  role: string;
}) {
  try {
    const result = await pool.query(
      `INSERT INTO users (address, email, role, created_at) 
       VALUES ($1, $2, $3, NOW()) 
       RETURNING id, address, email, role, created_at`,
      [data.address, data.email || null, data.role]
    );
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
    const result = await pool.query(
      `UPDATE users SET role = $1, updated_at = NOW() 
       WHERE address = $2 
       RETURNING id, address, email, role`,
      [role, address]
    );
    return result.rows[0];
  }catch (error) {
    console.error('[LoginAPI] Error updating user role:', error);
    throw error;
  }
}
