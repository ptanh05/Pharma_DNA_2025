/**
 * API Route: GET /api/v1/auth/user/me
 * Lấy thông tin user hiện tại dựa trên JWT token
 *
 * Headers:
 * - Authorization: Bearer <access_token>
 */

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifyToken, extractTokenFromHeader, UserPayload } from "@/lib/auth/jwt";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    // Extract and verify token
    const authHeader = req.headers.get("authorization");
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Authorization token required" },
        { status: 401 }
      );
    }

    // Verify JWT token
    const userPayload: UserPayload = await verifyToken(token);

    // Query user from database
    const result = await pool.query(
      "SELECT address, role, email, assigned_at, updated_at, created_at FROM users WHERE address = $1",
      [userPayload.address.toLowerCase()]
    );

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
          id: userPayload.userId,
          address: user.address,
          email: user.email,
          role: user.role,
          createdAt: user.created_at,
          assignedAt: user.assigned_at,
        },
        role: user.role,
        hasRole: !!user.role,
      },
    });
  } catch (error: any) {
    console.error("[GetUserMe] Error details:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    // Handle specific error types
    if (error.message === "Token has expired") {
      return NextResponse.json(
        { success: false, error: "Token has expired" },
        { status: 401 }
      );
    }

    if (error.message === "Invalid token" || error.message === "Invalid token signature") {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
