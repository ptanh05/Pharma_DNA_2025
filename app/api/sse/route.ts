/**
 * SSE (Server-Sent Events) Endpoint
 * Real-time notifications for serverless environments (Vercel, etc.)
 *
 * Delegates connection management to lib/sse.ts so that
 * lib/socket/events.ts and lib/socket/server.ts can share the same
 * in-memory registry without importing from App Router routes.
 */

import { NextRequest } from "next/server";
import {
  addSSEConnection,
  removeSSEConnection,
  formatSSEMessage,
  startCleanup,
} from "@/lib/sse";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const role = searchParams.get("role") || undefined;

  if (!address) {
    return new Response(
      "Missing required 'address' query parameter",
      { status: 400 }
    );
  }

  // Sui address validation (0x + 64 hex chars)
  if (!/^0x[a-fA-F0-9]{64}$/.test(address)) {
    return new Response("Invalid Sui address format", { status: 400 });
  }

  startCleanup();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      addSSEConnection(address, controller, role);

      // Send initial connection confirmation
      const welcome = formatSSEMessage("__connected", {
        address,
        role,
        message: "SSE connection established",
      });
      controller.enqueue(new TextEncoder().encode(welcome));
    },
    cancel() {
      removeSSEConnection(address);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
