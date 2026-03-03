import { NextRequest } from "next/server";
import { executeAgentTask } from "@/lib/ai-agent/core";
import { getRateLimitStatus }from "@/lib/ai-agent/rate-limiter";
import { createSuccessResponse, createErrorResponse }from "@/lib/utils/api-response";
import { validateRequestBody, getClientIP } from "@/lib/utils/api-validator";
import { AppError, ErrorTypes } from "@/lib/utils/error-handler";
import { z } from "zod";

// Request validation schema
const executeTaskSchema = z.object({
  task: z.string().min(1, "Task is required"),
  context: z.any().optional(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
});

/**
 * POST /api/ai-agent/execute
 * Execute một task với AI Agent
 */
export async function POST(req: NextRequest) {
  try {
    // Validate request body
    const { task, context, sessionId, userId } = validateRequestBody(
      req,
      executeTaskSchema
    );

    // Check OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      throw new AppError(
        "OPENAI_API_KEY is not configured",
        ErrorTypes.INTERNAL_ERROR.code,
        ErrorTypes.INTERNAL_ERROR.statusCode
      );
    }

    const clientIP = getClientIP(req);
    const rateLimitKey = userId || sessionId || "anonymous";
    const rateLimitStatus = getRateLimitStatus(rateLimitKey);

    // Execute agent task
    const result = await executeAgentTask(
      task,
      context,
      sessionId || "default",
      userId,
      clientIP
    );

    return createSuccessResponse({
      result: result.output,
      steps: result.steps || [],
      fromCache: result.fromCache || false,
      rateLimit: {
        remaining: rateLimitStatus.remaining,
        resetAt: new Date(rateLimitStatus.resetAt).toISOString(),
      },
    });
  } catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_EXECUTE");
  }
}
