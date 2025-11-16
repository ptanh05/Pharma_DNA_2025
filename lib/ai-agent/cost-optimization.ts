/**
 * Cost Optimization System
 * Tối ưu hóa cost của AI Agent operations
 */

import { pool } from "@/lib/db";

export interface CostMetrics {
  totalTokens: number;
  totalCost: number; // USD
  avgCostPerRequest: number;
  cacheHitRate: number; // 0-1
  modelUsage: Record<string, number>; // Model -> token count
  period: string;
}

export interface OptimizationStrategy {
  strategy: "cache" | "batch" | "model_selection" | "prompt_optimization";
  impact: number; // Estimated cost savings percentage
  description: string;
  enabled: boolean;
}

/**
 * Track token usage
 */
export async function trackTokenUsage(
  model: string,
  promptTokens: number,
  completionTokens: number,
  cost: number
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO token_usage (model, prompt_tokens, completion_tokens, total_tokens, cost, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [model, promptTokens, completionTokens, promptTokens + completionTokens, cost]
    );
  } catch (error) {
    console.error("Error tracking token usage:", error);
  }
}

/**
 * Get cost metrics
 */
export async function getCostMetrics(period: string = "7d"): Promise<CostMetrics> {
  try {
    let dateFilter = "";
    switch (period) {
      case "24h":
        dateFilter = "WHERE created_at >= NOW() - INTERVAL '24 hours'";
        break;
      case "7d":
        dateFilter = "WHERE created_at >= NOW() - INTERVAL '7 days'";
        break;
      case "30d":
        dateFilter = "WHERE created_at >= NOW() - INTERVAL '30 days'";
        break;
    }

    // Get token usage
    const tokenStats = await pool.query(`
      SELECT 
        SUM(total_tokens) as total_tokens,
        SUM(cost) as total_cost,
        COUNT(*) as request_count,
        model,
        SUM(total_tokens) as model_tokens
      FROM token_usage
      ${dateFilter}
      GROUP BY model
    `);

    const totalTokens = tokenStats.rows.reduce((sum, row) => sum + parseInt(row.total_tokens || "0"), 0);
    const totalCost = tokenStats.rows.reduce((sum, row) => sum + parseFloat(row.total_cost || "0"), 0);
    const requestCount = tokenStats.rows.reduce((sum, row) => sum + parseInt(row.request_count || "0"), 0);

    // Get cache hit rate
    const cacheStats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE from_cache = true) as cache_hits,
        COUNT(*) as total_requests
      FROM agent_audit_logs
      ${dateFilter}
    `);

    const cacheHits = parseInt(cacheStats.rows[0]?.cache_hits || "0");
    const totalRequests = parseInt(cacheStats.rows[0]?.total_requests || "0");
    const cacheHitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;

    // Model usage breakdown
    const modelUsage: Record<string, number> = {};
    for (const row of tokenStats.rows) {
      modelUsage[row.model] = parseInt(row.model_tokens || "0");
    }

    return {
      totalTokens,
      totalCost,
      avgCostPerRequest: requestCount > 0 ? totalCost / requestCount : 0,
      cacheHitRate,
      modelUsage,
      period,
    };
  } catch (error) {
    console.error("Error getting cost metrics:", error);
    return {
      totalTokens: 0,
      totalCost: 0,
      avgCostPerRequest: 0,
      cacheHitRate: 0,
      modelUsage: {},
      period,
    };
  }
}

/**
 * Get optimization strategies
 */
export async function getOptimizationStrategies(): Promise<OptimizationStrategy[]> {
  try {
    const metrics = await getCostMetrics("7d");
    const strategies: OptimizationStrategy[] = [];

    // Strategy 1: Improve caching
    if (metrics.cacheHitRate < 0.5) {
      strategies.push({
        strategy: "cache",
        impact: (0.5 - metrics.cacheHitRate) * 100, // Potential savings
        description: `Cache hit rate is ${(metrics.cacheHitRate * 100).toFixed(1)}%. Improve caching to save up to ${((0.5 - metrics.cacheHitRate) * 100).toFixed(1)}% costs.`,
        enabled: true,
      });
    }

    // Strategy 2: Use cheaper models for simple tasks
    if (metrics.modelUsage["gpt-4"] > 0) {
      const gpt4Tokens = metrics.modelUsage["gpt-4"] || 0;
      const totalTokens = metrics.totalTokens;
      if (gpt4Tokens / totalTokens > 0.3) {
        strategies.push({
          strategy: "model_selection",
          impact: 50, // GPT-4 is ~10x more expensive than GPT-3.5
          description: `${((gpt4Tokens / totalTokens) * 100).toFixed(1)}% of tokens use GPT-4. Consider using GPT-3.5 for simple tasks to save ~50% costs.`,
          enabled: true,
        });
      }
    }

    // Strategy 3: Batch processing
    strategies.push({
      strategy: "batch",
      impact: 20,
      description: "Use batch operations to reduce API calls and improve efficiency.",
      enabled: true,
    });

    // Strategy 4: Prompt optimization
    strategies.push({
      strategy: "prompt_optimization",
      impact: 15,
      description: "Optimize prompts to reduce token usage while maintaining quality.",
      enabled: true,
    });

    return strategies;
  } catch (error) {
    console.error("Error getting optimization strategies:", error);
    return [];
  }
}

/**
 * Estimate cost for task
 */
export function estimateTaskCost(task: string, model: string = "gpt-3.5-turbo"): number {
  // Rough estimation based on task length
  const promptTokens = Math.ceil(task.length / 4); // ~4 chars per token
  const estimatedCompletionTokens = 200; // Average response

  // Pricing (as of 2024, adjust as needed)
  const pricing: Record<string, { input: number; output: number }> = {
    "gpt-3.5-turbo": { input: 0.0015 / 1000, output: 0.002 / 1000 },
    "gpt-4": { input: 0.03 / 1000, output: 0.06 / 1000 },
    "gpt-4-turbo": { input: 0.01 / 1000, output: 0.03 / 1000 },
  };

  const modelPricing = pricing[model] || pricing["gpt-3.5-turbo"];
  const cost = promptTokens * modelPricing.input + estimatedCompletionTokens * modelPricing.output;

  return cost;
}

/**
 * Select optimal model for task
 */
export function selectOptimalModel(task: string, complexity: "simple" | "medium" | "complex" = "medium"): string {
  // Simple tasks: use cheaper model
  if (complexity === "simple") {
    return "gpt-3.5-turbo";
  }

  // Complex tasks: use more capable model
  if (complexity === "complex") {
    return "gpt-4-turbo";
  }

  // Medium: default to GPT-3.5, upgrade if needed
  return "gpt-3.5-turbo";
}

/**
 * Get cost breakdown by tool
 */
export async function getCostBreakdownByTool(period: string = "7d"): Promise<Record<string, number>> {
  try {
    let dateFilter = "";
    switch (period) {
      case "24h":
        dateFilter = "WHERE created_at >= NOW() - INTERVAL '24 hours'";
        break;
      case "7d":
        dateFilter = "WHERE created_at >= NOW() - INTERVAL '7 days'";
        break;
      case "30d":
        dateFilter = "WHERE created_at >= NOW() - INTERVAL '30 days'";
        break;
    }

    // Join audit logs with token usage (if we track tool usage)
    const breakdown = await pool.query(`
      SELECT 
        tool,
        COUNT(*) as usage_count,
        AVG(EXTRACT(EPOCH FROM (updated_at - timestamp))) as avg_duration
      FROM agent_audit_logs
      ${dateFilter.replace("created_at", "timestamp")}
      WHERE tool IS NOT NULL
      GROUP BY tool
      ORDER BY usage_count DESC
    `);

    const result: Record<string, number> = {};
    for (const row of breakdown.rows) {
      // Estimate cost based on usage (rough estimate)
      const estimatedCost = parseInt(row.usage_count) * 0.01; // $0.01 per tool call estimate
      result[row.tool] = estimatedCost;
    }

    return result;
  } catch (error) {
    console.error("Error getting cost breakdown:", error);
    return {};
  }
}

/**
 * Initialize cost tracking tables
 */
export async function initializeCostTracking(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS token_usage (
        id SERIAL PRIMARY KEY,
        model VARCHAR(50) NOT NULL,
        prompt_tokens INTEGER NOT NULL,
        completion_tokens INTEGER NOT NULL,
        total_tokens INTEGER NOT NULL,
        cost DECIMAL(10, 6) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_token_usage_created_at 
      ON token_usage(created_at)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_token_usage_model 
      ON token_usage(model)
    `);
  } catch (error) {
    console.error("Error initializing cost tracking:", error);
  }
}

// Initialize on module load
if (typeof window === "undefined") {
  initializeCostTracking();
}

