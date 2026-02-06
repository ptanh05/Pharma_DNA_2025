/**
 * Request Logging Middleware
 */

import { NextRequest } from "next/server";
import { logger }from "@/lib/utils/logger";

export function logRequest(req: NextRequest): void {
  const method = req.method;
  const url = req.url;
  const ip = req.headers.get("x-forwarded-for") || "unknown";

  logger.info("request", `${method} ${url}`, { ip });
}
