/**
 * Alias route: /api/nfts -> /api/admin/nfts
 * Redirects to admin NFTs endpoint
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address") || "";
  const page = searchParams.get("page") || "1";
  const limit = searchParams.get("limit") || "50";

  try {
    const params = new URLSearchParams();
    if (address) params.set("address", address);
    params.set("page", page);
    params.set("limit", limit);

    const res = await fetch(
      `${req.nextUrl.origin}/api/admin/nfts?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
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
