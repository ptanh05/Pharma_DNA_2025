import { NextRequest, NextResponse } from "next/server";
import { pool }from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams }= new URL(req.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { success: false, error: "Address is required" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      "SELECT address, role, assigned_at, updated_at FROM users WHERE address = $1",
      [address.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: { user: null, role: null, hasRole: false },
      });
    }

    const user = result.rows[0];

    return NextResponse.json({
      success: true,
      data: {
        user: { address: user.address, role: user.role },
        role: user.role,
        hasRole: true,
      },
    });
  }catch (error: any) {
    console.error("[GetUserMe] Error details:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
