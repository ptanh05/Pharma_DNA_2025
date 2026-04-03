/**
 * Alias route: /api/users -> /api/admin/users
 * Redirects to admin users endpoint
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = searchParams.get("page") || "1";
  const limit = searchParams.get("limit") || "10";

  try {
    const res = await fetch(
      `${req.nextUrl.origin}/api/admin/users?page=${page}&limit=${limit}`,
      {
        method: "GET",
        headers: {
          ...Object.fromEntries(req.headers),
          "x-forwarded-host": undefined as any,
        },
      }
    );

    const data = await res.json();

    // Normalize response: if success wrapper exists, unwrap it
    const users = data?.data?.users ?? data?.data ?? data?.users ?? data;
    return NextResponse.json(Array.isArray(users) ? users : [], {
      status: res.status,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
