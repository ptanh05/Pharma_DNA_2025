import { NextRequest } from "next/server";
import {
  createWorkflow,
  getWorkflows,
  updateWorkflow,
  deleteWorkflow,
  executeWorkflow,
} from "@/lib/ai-agent/workflow";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateRequestBody, validateQueryParams } from "@/lib/utils/api-validator";
import { z } from "zod";

// Query validation schema
const workflowsQuerySchema = z.object({
  enabled: z.string().default("false").transform(v => v === "true"),
});

// POST request validation schema
const createWorkflowSchema = z.object({
  name: z.string().min(1, "Workflow name is required"),
  description: z.string().optional(),
  task: z.string().optional(),
  steps: z.array(z.any()).min(1, "At least one step is required"),
  active: z.boolean().default(true),
});

// PUT request validation schema
const updateWorkflowSchema = z.object({
  id: z.string().min(1, "Workflow ID is required"),
  name: z.string().optional(),
  description: z.string().optional(),
  task: z.string().optional(),
  steps: z.array(z.any()).optional(),
  active: z.boolean().optional(),
});

// DELETE request validation schema
const deleteWorkflowSchema = z.object({
  id: z.string().min(1, "Workflow ID is required"),
});

/**
 * GET /api/ai-agent/workflows
 * Get all workflows
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { enabled }= validateQueryParams(searchParams, workflowsQuerySchema);

    const workflows = await getWorkflows(enabled);

    return createSuccessResponse({ workflows });
  } catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_WORKFLOWS_GET");
  }
}

/**
 * POST /api/ai-agent/workflows
 * Create new workflow
 */
export async function POST(req: NextRequest) {
  try {
    const { name, description, steps, active } = await validateRequestBody(
      req,
      createWorkflowSchema
    );

    const workflow = await createWorkflow({
      name,
      description: description || "",
      task: "",
      schedule: "manual",
      enabled: active !== false,
      runCount: 0,
      successCount: 0,
      failureCount: 0,
    });

    return createSuccessResponse({ workflow }, 201);
  }catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_WORKFLOWS_POST");
  }
}

/**
 * PUT /api/ai-agent/workflows
 * Update workflow
 */
export async function PUT(req: NextRequest) {
  try {
    const { id, name, description, steps, active } = await validateRequestBody(
      req,
      updateWorkflowSchema
    );

    const workflow = await updateWorkflow(Number(id), {
      name,
      description,
      enabled: active,
    });

    return createSuccessResponse({ workflow });
  }catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_WORKFLOWS_PUT");
  }
}

/**
 * DELETE /api/ai-agent/workflows
 * Delete workflow
 */
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await validateRequestBody(req, deleteWorkflowSchema);

    await deleteWorkflow(Number(id));

    return createSuccessResponse({ message: "Workflow deleted successfully" });
  } catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_WORKFLOWS_DELETE");
  }
}
