/**
 * Socket.io API Route Handler for App Router
 * For production, consider using a separate Socket.io server or Server-Sent Events
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: "ok",
    message: "Socket.io endpoint (polling mode for serverless compatibility)"
  });
}

export async function POST(req: NextRequest) {
  return NextResponse.json({
    status: "ok",
    message: "Event emitted (use polling or SSE for real-time updates)"
  });
}
