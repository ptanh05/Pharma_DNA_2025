/**
 * Alias route: /api/stats -> /api/admin/stats
 * Redirects to admin stats endpoint
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "week";

  try {
    const res = await fetch(
      `${req.nextUrl.origin}/api/admin/stats?period=${period}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...Object.fromEntries(req.headers),
          "x-forwarded-host": undefined as any,
        },
      }
    );

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
