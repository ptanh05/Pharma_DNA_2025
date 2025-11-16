/**
 * Workflow Automation & Scheduling System
 * Tự động chạy tasks theo lịch và workflow automation
 */

import { pool } from "@/lib/db";
import { executeAgentTask } from "./core";

export interface Workflow {
  id?: number;
  name: string;
  description: string;
  task: string;
  schedule: string; // Cron expression hoặc "manual"
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  successCount: number;
  failureCount: number;
  context?: any;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WorkflowExecution {
  id?: number;
  workflowId: number;
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
}

// In-memory workflow scheduler
// Note: setInterval doesn't work in Vercel serverless
// Use Vercel Cron Jobs or external scheduler instead
const workflowScheduler = new Map<number, NodeJS.Timeout>();

// Check if running in serverless environment
const isServerless = typeof process !== "undefined" && (process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME);

/**
 * Parse cron expression (simplified - supports basic patterns)
 */
function parseCronExpression(cron: string): { interval: number; unit: "minute" | "hour" | "day" } | null {
  // Simple cron parser - supports: "*/5 * * * *" (every 5 minutes), "0 * * * *" (every hour), "0 0 * * *" (daily)
  const parts = cron.trim().split(/\s+/);
  
  if (parts.length < 5) return null;

  const minute = parts[0];
  const hour = parts[1];
  const day = parts[2];

  // Every N minutes: "*/N"
  if (minute.startsWith("*/")) {
    const n = parseInt(minute.substring(2));
    if (!isNaN(n) && n > 0) {
      return { interval: n, unit: "minute" };
    }
  }

  // Every hour: "0 * * * *"
  if (minute === "0" && hour === "*") {
    return { interval: 1, unit: "hour" };
  }

  // Daily: "0 0 * * *"
  if (minute === "0" && hour === "0" && day === "*") {
    return { interval: 1, unit: "day" };
  }

  return null;
}

/**
 * Calculate next run time
 */
function calculateNextRun(schedule: string): Date | null {
  if (schedule === "manual") return null;

  const parsed = parseCronExpression(schedule);
  if (!parsed) return null;

  const now = new Date();
  const next = new Date(now);

  switch (parsed.unit) {
    case "minute":
      next.setMinutes(next.getMinutes() + parsed.interval);
      break;
    case "hour":
      next.setHours(next.getHours() + parsed.interval);
      break;
    case "day":
      next.setDate(next.getDate() + parsed.interval);
      break;
  }

  return next;
}

/**
 * Create workflow
 */
export async function createWorkflow(workflow: Workflow): Promise<Workflow> {
  const nextRun = workflow.schedule !== "manual" ? calculateNextRun(workflow.schedule) : null;

  const result = await pool.query(
    `INSERT INTO workflows (name, description, task, schedule, enabled, next_run, context, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
     RETURNING *`,
    [
      workflow.name,
      workflow.description,
      workflow.task,
      workflow.schedule,
      workflow.enabled,
      nextRun,
      workflow.context ? JSON.stringify(workflow.context) : null,
      workflow.createdBy || null,
    ]
  );

  const created = result.rows[0];
  // Only schedule if not in serverless environment
  if (created.enabled && created.schedule !== "manual" && !isServerless) {
    scheduleWorkflow(created.id);
  }

  return {
    id: created.id,
    name: created.name,
    description: created.description,
    task: created.task,
    schedule: created.schedule,
    enabled: created.enabled,
    nextRun: created.next_run,
    runCount: 0,
    successCount: 0,
    failureCount: 0,
    context: created.context ? JSON.parse(created.context) : undefined,
    createdAt: created.created_at,
    updatedAt: created.updated_at,
  };
}

/**
 * Schedule workflow execution
 */
function scheduleWorkflow(workflowId: number): void {
  // Clear existing schedule
  if (workflowScheduler.has(workflowId)) {
    clearInterval(workflowScheduler.get(workflowId)!);
  }

  // Get workflow
  pool.query("SELECT * FROM workflows WHERE id = $1", [workflowId])
    .then(result => {
      if (result.rows.length === 0) return;
      
      const workflow = result.rows[0];
      if (!workflow.enabled || workflow.schedule === "manual") return;

      const parsed = parseCronExpression(workflow.schedule);
      if (!parsed) return;

      let intervalMs: number;
      switch (parsed.unit) {
        case "minute":
          intervalMs = parsed.interval * 60 * 1000;
          break;
        case "hour":
          intervalMs = parsed.interval * 60 * 60 * 1000;
          break;
        case "day":
          intervalMs = parsed.interval * 24 * 60 * 60 * 1000;
          break;
        default:
          return;
      }

      // Schedule execution
      const interval = setInterval(async () => {
        await executeWorkflow(workflowId);
      }, intervalMs);

      workflowScheduler.set(workflowId, interval);
    })
    .catch(error => {
      console.error(`Error scheduling workflow ${workflowId}:`, error);
    });
}

/**
 * Execute workflow
 */
export async function executeWorkflow(workflowId: number, manual: boolean = false): Promise<WorkflowExecution> {
  // Get workflow
  const workflowResult = await pool.query("SELECT * FROM workflows WHERE id = $1", [workflowId]);
  if (workflowResult.rows.length === 0) {
    throw new Error("Workflow not found");
  }

  const workflow = workflowResult.rows[0];
  if (!workflow.enabled && !manual) {
    throw new Error("Workflow is disabled");
  }

  // Create execution record
  const execResult = await pool.query(
    `INSERT INTO workflow_executions (workflow_id, status, started_at)
     VALUES ($1, $2, NOW())
     RETURNING *`,
    [workflowId, "running"]
  );

  const execution = execResult.rows[0];

  try {
    // Execute task
    const result = await executeAgentTask(
      workflow.task,
      workflow.context ? JSON.parse(workflow.context) : undefined,
      `workflow_${workflowId}`,
      workflow.created_by,
      undefined
    );

    // Update execution
    await pool.query(
      `UPDATE workflow_executions 
       SET status = $1, completed_at = NOW(), result = $2
       WHERE id = $3`,
      ["completed", JSON.stringify(result), execution.id]
    );

    // Update workflow stats
    await pool.query(
      `UPDATE workflows 
       SET run_count = run_count + 1, 
           success_count = success_count + 1,
           last_run = NOW(),
           next_run = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [workflow.schedule !== "manual" ? calculateNextRun(workflow.schedule) : null, workflowId]
    );

    return {
      id: execution.id,
      workflowId,
      status: "completed",
      startedAt: execution.started_at,
      completedAt: new Date(),
      result,
    };
  } catch (error: any) {
    // Update execution with error
    await pool.query(
      `UPDATE workflow_executions 
       SET status = $1, completed_at = NOW(), error = $2
       WHERE id = $3`,
      ["failed", error.message, execution.id]
    );

    // Update workflow stats
    await pool.query(
      `UPDATE workflows 
       SET run_count = run_count + 1, 
           failure_count = failure_count + 1,
           last_run = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [workflowId]
    );

    return {
      id: execution.id,
      workflowId,
      status: "failed",
      startedAt: execution.started_at,
      completedAt: new Date(),
      error: error.message,
    };
  }
}

/**
 * Get all workflows
 */
export async function getWorkflows(enabledOnly: boolean = false): Promise<Workflow[]> {
  const query = enabledOnly
    ? "SELECT * FROM workflows WHERE enabled = true ORDER BY created_at DESC"
    : "SELECT * FROM workflows ORDER BY created_at DESC";

  const result = await pool.query(query);
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    task: row.task,
    schedule: row.schedule,
    enabled: row.enabled,
    lastRun: row.last_run,
    nextRun: row.next_run,
    runCount: row.run_count || 0,
    successCount: row.success_count || 0,
    failureCount: row.failure_count || 0,
    context: row.context ? JSON.parse(row.context) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Update workflow
 */
export async function updateWorkflow(workflowId: number, updates: Partial<Workflow>): Promise<Workflow> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramCount++}`);
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${paramCount++}`);
    values.push(updates.description);
  }
  if (updates.task !== undefined) {
    fields.push(`task = $${paramCount++}`);
    values.push(updates.task);
  }
  if (updates.schedule !== undefined) {
    fields.push(`schedule = $${paramCount++}`);
    values.push(updates.schedule);
    const nextRun = updates.schedule !== "manual" ? calculateNextRun(updates.schedule) : null;
    fields.push(`next_run = $${paramCount++}`);
    values.push(nextRun);
  }
  if (updates.enabled !== undefined) {
    fields.push(`enabled = $${paramCount++}`);
    values.push(updates.enabled);
  }
  if (updates.context !== undefined) {
    fields.push(`context = $${paramCount++}`);
    values.push(JSON.stringify(updates.context));
  }

  fields.push(`updated_at = NOW()`);
  values.push(workflowId);

  const result = await pool.query(
    `UPDATE workflows SET ${fields.join(", ")} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    throw new Error("Workflow not found");
  }

  const updated = result.rows[0];

  // Reschedule if enabled (only if not serverless)
  if (updated.enabled && updated.schedule !== "manual" && !isServerless) {
    scheduleWorkflow(workflowId);
  } else {
    // Clear schedule if disabled
    if (workflowScheduler.has(workflowId)) {
      clearInterval(workflowScheduler.get(workflowId)!);
      workflowScheduler.delete(workflowId);
    }
  }

  return {
    id: updated.id,
    name: updated.name,
    description: updated.description,
    task: updated.task,
    schedule: updated.schedule,
    enabled: updated.enabled,
    lastRun: updated.last_run,
    nextRun: updated.next_run,
    runCount: updated.run_count || 0,
    successCount: updated.success_count || 0,
    failureCount: updated.failure_count || 0,
    context: updated.context ? JSON.parse(updated.context) : undefined,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
  };
}

/**
 * Delete workflow
 */
export async function deleteWorkflow(workflowId: number): Promise<void> {
  // Clear schedule
  if (workflowScheduler.has(workflowId)) {
    clearInterval(workflowScheduler.get(workflowId)!);
    workflowScheduler.delete(workflowId);
  }

  await pool.query("DELETE FROM workflows WHERE id = $1", [workflowId]);
}

/**
 * Initialize workflows on startup
 */
export async function initializeWorkflows(): Promise<void> {
  try {
    // Create tables if not exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workflows (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        task TEXT NOT NULL,
        schedule VARCHAR(100) NOT NULL,
        enabled BOOLEAN DEFAULT true,
        last_run TIMESTAMP,
        next_run TIMESTAMP,
        run_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        context JSONB,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS workflow_executions (
        id SERIAL PRIMARY KEY,
        workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        result JSONB,
        error TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Load and schedule all enabled workflows (only if not serverless)
    if (!isServerless) {
      const workflows = await getWorkflows(true);
      for (const workflow of workflows) {
        if (workflow.id && workflow.schedule !== "manual") {
          scheduleWorkflow(workflow.id);
        }
      }
    }
  } catch (error) {
    console.error("Error initializing workflows:", error);
  }
}

// Initialize on module load
if (typeof window === "undefined") {
  initializeWorkflows();
}

