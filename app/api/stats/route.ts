/**
 * Alias route: /api/stats -> /api/admin/stats
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const params = new URLSearchParams(searchParams);

    const adminToken = req.headers.get("authorization");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (adminToken) headers["Authorization"] = adminToken;

    const res = await fetch(
      `${req.nextUrl.origin}/api/admin/stats?${params.toString()}`,
      { method: "GET", headers }
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
