import { NextRequest }from "next/server";
import { getAgentMemory } from "@/lib/ai-agent/core";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z } from "zod";

// Query validation schema
const historyQuerySchema = z.object({
  sessionId: z.string().default("default"),
});

/**
 * GET /api/ai-agent/history?sessionId=xxx
 * Lấy lịch sử conversation
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { sessionId }= validateQueryParams(searchParams, historyQuerySchema);

    const memory = getAgentMemory(sessionId);

    return createSuccessResponse({
      sessionId,
      history: memory,
      count: memory.length,
    });
  } catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_HISTORY");
  }
}
