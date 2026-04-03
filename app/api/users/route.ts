/**
 * Alias route: /api/users -> /api/admin/users
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const params = new URLSearchParams(searchParams);

    const res = await fetch(
      `${req.nextUrl.origin}/api/admin/users?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await res.json();

    // unwrap success wrapper to return flat array for backward compat
    const users =
      data?.data?.users ??
      data?.users ??
      (data?.data && !Array.isArray(data.data) ? data.data : data);
    return NextResponse.json(Array.isArray(users) ? users : [], {
      status: res.status,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
