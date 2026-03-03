import { NextRequest } from "next/server";
import { getSpecializedAgent } from "@/lib/ai-agent/agents-specialized";
import { createSuccessResponse, createErrorResponse }from "@/lib/utils/api-response";
import { validateRequestBody } from "@/lib/utils/api-validator";
import { z } from "zod";

// Request validation schema
const specializedAgentSchema = z.object({
  role: z.enum(["manufacturer", "distributor", "pharmacy", "admin", "quality"]),
  task: z.string().min(1, "Task is required"),
  context: z.any().optional(),
});

/**
 * POST /api/ai-agent/specialized
 * Execute task with specialized agent
 */
export async function POST(req: NextRequest) {
  try {
    const { role, task, context } = validateRequestBody(
      req,
      specializedAgentSchema
    );

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const agent = await getSpecializedAgent(role);

    let fullTask = task;
    if (context) {
      fullTask = `${task}\n\nContext: ${JSON.stringify(context, null, 2)}`;
    }

    const result = await agent.invoke({
      input: fullTask,
    });

    return createSuccessResponse({
      role,
      result: result.output,
      steps: result.steps || [],
    });
  } catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_SPECIALIZED");
  }
}
