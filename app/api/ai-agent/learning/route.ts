import { NextRequest } from "next/server";
import {
  getRecommendations,
  getFailurePatterns,
  getPerformanceMetrics,
  createAdaptationRule,
  getApplicableRules,
}from "@/lib/ai-agent/learning";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateRequestBody, validateQueryParams } from "@/lib/utils/api-validator";
import { z } from "zod";

// Query validation schema
const learningQuerySchema = z.object({
  type: z.enum(["recommendations", "failures", "metrics", "rules"]).default("recommendations"),
  context: z.string().optional(),
  action: z.string().optional(),
  timeRange: z.enum(["7d", "30d", "all"]).default("7d"),
});

// POST request validation schema
const adaptationRuleSchema = z.object({
  condition: z.string().min(1, "Condition is required"),
  action: z.string().min(1, "Action is required"),
  priority: z.number().default(1),
});

/**
 * GET /api/ai-agent/learning
 * Get learning insights
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { type, context, action, timeRange } = validateQueryParams(searchParams, learningQuerySchema);

    switch (type) {
      case "recommendations":
        const recContext = context ? JSON.parse(context) : {};
        const recommendations = await getRecommendations(recContext, action || undefined);
        return createSuccessResponse({ recommendations });

      case "failures":
        const failContext = context ? JSON.parse(context) : {};
        const failures = await getFailurePatterns(failContext);
        return createSuccessResponse({ failures });

      case "metrics":
        const metrics = await getPerformanceMetrics(timeRange);
        return createSuccessResponse({ metrics });

      case "rules":
        const rulesContext = context ? JSON.parse(context) : {};
        const rules = await getApplicableRules(rulesContext);
        return createSuccessResponse({ rules });

      default:
        throw new Error("Invalid type");
    }
  } catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_LEARNING_GET");
  }
}

/**
 * POST /api/ai-agent/learning
 * Create adaptation rule
 */
export async function POST(req: NextRequest) {
  try {
    const { condition, action, priority }= await validateRequestBody(
      req,
      adaptationRuleSchema
    );

    const rule = await createAdaptationRule(condition, action, priority);

    return createSuccessResponse({ rule }, 201);
  }catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_LEARNING_POST");
  }
}
