/**
 * Learning & Adaptation System
 * Machine learning để cải thiện performance và adaptive scheduling
 */

import { pool } from "@/lib/db";
import { logger } from "@/lib/utils/logger";

export interface LearningPattern {
  id?: number;
  patternType: "success" | "failure" | "optimization";
  context: any;
  action: string;
  result: any;
  performance: number; // 0-1 score
  frequency: number;
  lastSeen: Date;
  createdAt: Date;
}

export interface AdaptationRule {
  id?: number;
  condition: string; // JSON condition
  action: string;
  priority: number;
  enabled: boolean;
  successRate: number;
  usageCount: number;
  createdAt: Date;
}

/**
 * Learn from successful execution
 */
export async function learnFromSuccess(
  context: any,
  action: string,
  result: any,
  performance: number
): Promise<void> {
  try {
    // Find or create pattern
    const patternKey = JSON.stringify({ context, action });
    const existing = await pool.query(
      `SELECT * FROM learning_patterns 
       WHERE pattern_type = 'success' 
       AND context::text = $1 
       AND action = $2`,
      [JSON.stringify(context), action]
    );

    if (existing.rows.length > 0) {
      // Update existing pattern
      const pattern = existing.rows[0];
      const newFrequency = pattern.frequency + 1;
      const newPerformance = (pattern.performance * pattern.frequency + performance) / newFrequency;

      await pool.query(
        `UPDATE learning_patterns 
         SET frequency = $1, performance = $2, last_seen = NOW(), result = $3
         WHERE id = $4`,
        [newFrequency, newPerformance, JSON.stringify(result), pattern.id]
      );
    } else {
      // Create new pattern
      await pool.query(
        `INSERT INTO learning_patterns (pattern_type, context, action, result, performance, frequency, last_seen, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        ["success", JSON.stringify(context), action, JSON.stringify(result), performance, 1]
      );
    }
  } catch (error) {
    logger.error("AI_LEARNING", "Error learning from success", error as Error);
  }
}

/**
 * Learn from failure
 */
export async function learnFromFailure(
  context: any,
  action: string,
  error: string,
  performance: number = 0
): Promise<void> {
  try {
    const existing = await pool.query(
      `SELECT * FROM learning_patterns 
       WHERE pattern_type = 'failure' 
       AND context::text = $1 
       AND action = $2`,
      [JSON.stringify(context), action]
    );

    if (existing.rows.length > 0) {
      const pattern = existing.rows[0];
      await pool.query(
        `UPDATE learning_patterns 
         SET frequency = frequency + 1, last_seen = NOW(), result = $1
         WHERE id = $2`,
        [JSON.stringify({ error, performance }), pattern.id]
      );
    } else {
      await pool.query(
        `INSERT INTO learning_patterns (pattern_type, context, action, result, performance, frequency, last_seen, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        ["failure", JSON.stringify(context), action, JSON.stringify({ error, performance }), performance, 1]
      );
    }
  } catch (error) {
    logger.error("AI_LEARNING", "Error learning from failure", error as Error);
  }
}

/**
 * Get recommendations based on learned patterns
 */
export async function getRecommendations(context: any, action?: string): Promise<any[]> {
  try {
    let query = `
      SELECT * FROM learning_patterns 
      WHERE pattern_type = 'success'
      AND context::text LIKE $1
    `;
    const params: any[] = [`%${JSON.stringify(context).substring(0, 100)}%`];

    if (action) {
      query += ` AND action = $2`;
      params.push(action);
    }

    query += ` ORDER BY performance DESC, frequency DESC LIMIT 10`;

    const result = await pool.query(query, params);
    return result.rows.map(row => ({
      action: row.action,
      context: JSON.parse(row.context),
      result: JSON.parse(row.result),
      performance: row.performance,
      frequency: row.frequency,
      confidence: Math.min(1, row.frequency / 10) * row.performance, // Confidence score
    }));
  } catch (error) {
    logger.error("AI_LEARNING", "Error getting recommendations", error as Error);
    return [];
  }
}

/**
 * Get failure patterns to avoid
 */
export async function getFailurePatterns(context: any): Promise<any[]> {
  try {
    const result = await pool.query(
      `SELECT * FROM learning_patterns 
       WHERE pattern_type = 'failure'
       AND context::text LIKE $1
       ORDER BY frequency DESC
       LIMIT 10`,
      [`%${JSON.stringify(context).substring(0, 100)}%`]
    );

    return result.rows.map(row => ({
      action: row.action,
      context: JSON.parse(row.context),
      error: JSON.parse(row.result).error,
      frequency: row.frequency,
      risk: Math.min(1, row.frequency / 5), // Risk score
    }));
  } catch (error) {
    logger.error("AI_LEARNING", "Error getting failure patterns", error as Error);
    return [];
  }
}

/**
 * Create adaptation rule
 */
export async function createAdaptationRule(
  condition: any,
  action: string,
  priority: number = 1
): Promise<AdaptationRule> {
  const result = await pool.query(
    `INSERT INTO adaptation_rules (condition, action, priority, enabled, success_rate, usage_count, created_at)
     VALUES ($1, $2, $3, true, 0, 0, NOW())
     RETURNING *`,
    [JSON.stringify(condition), action, priority]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    condition: JSON.parse(row.condition),
    action: row.action,
    priority: row.priority,
    enabled: row.enabled,
    successRate: row.success_rate,
    usageCount: row.usage_count,
    createdAt: row.created_at,
  };
}

/**
 * Get applicable adaptation rules
 */
export async function getApplicableRules(context: any): Promise<AdaptationRule[]> {
  try {
    const allRules = await pool.query(
      `SELECT * FROM adaptation_rules WHERE enabled = true ORDER BY priority DESC`
    );

    const applicable: AdaptationRule[] = [];

    for (const row of allRules.rows) {
      const condition = JSON.parse(row.condition);
      if (evaluateCondition(condition, context)) {
        applicable.push({
          id: row.id,
          condition: condition,
          action: row.action,
          priority: row.priority,
          enabled: row.enabled,
          successRate: row.success_rate,
          usageCount: row.usage_count,
          createdAt: row.created_at,
        });
      }
    }

    return applicable;
  } catch (error) {
    logger.error("AI_LEARNING", "Error getting applicable rules", error as Error);
    return [];
  }
}

/**
 * Evaluate condition against context
 */
function evaluateCondition(condition: any, context: any): boolean {
  try {
    // Simple condition evaluation
    // Supports: { field: "value", operator: "equals|contains|greater|less" }
    if (typeof condition !== "object") return false;

    for (const [key, value] of Object.entries(condition)) {
      if (key === "operator") continue;

      const contextValue = context[key];
      const operator = condition.operator || "equals";

      switch (operator) {
        case "equals":
          if (contextValue !== value) return false;
          break;
        case "contains":
          if (!String(contextValue).includes(String(value))) return false;
          break;
        case "greater":
          if (Number(contextValue) <= Number(value)) return false;
          break;
        case "less":
          if (Number(contextValue) >= Number(value)) return false;
          break;
        default:
          return false;
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Update rule success rate
 */
export async function updateRuleSuccess(ruleId: number, success: boolean): Promise<void> {
  try {
    const rule = await pool.query("SELECT * FROM adaptation_rules WHERE id = $1", [ruleId]);
    if (rule.rows.length === 0) return;

    const current = rule.rows[0];
    const newUsageCount = current.usage_count + 1;
    const newSuccessRate = success
      ? (current.success_rate * current.usage_count + 1) / newUsageCount
      : (current.success_rate * current.usage_count) / newUsageCount;

    await pool.query(
      `UPDATE adaptation_rules 
       SET success_rate = $1, usage_count = $2
       WHERE id = $3`,
      [newSuccessRate, newUsageCount, ruleId]
    );
  } catch (error) {
    logger.error("AI_LEARNING", "Error updating rule success", error as Error);
  }
}

/**
 * Get performance metrics
 */
export async function getPerformanceMetrics(timeRange: string = "7d"): Promise<any> {
  try {
    let dateFilter = "";
    switch (timeRange) {
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

    const successPatterns = await pool.query(
      `SELECT AVG(performance) as avg_performance, SUM(frequency) as total_uses
       FROM learning_patterns 
       WHERE pattern_type = 'success' ${dateFilter.replace("WHERE", "AND")}`
    );

    const failurePatterns = await pool.query(
      `SELECT COUNT(*) as count, SUM(frequency) as total_failures
       FROM learning_patterns 
       WHERE pattern_type = 'failure' ${dateFilter.replace("WHERE", "AND")}`
    );

    const rules = await pool.query(
      `SELECT AVG(success_rate) as avg_success_rate, SUM(usage_count) as total_uses
       FROM adaptation_rules
       WHERE enabled = true`
    );

    return {
      successPatterns: {
        avgPerformance: parseFloat(successPatterns.rows[0]?.avg_performance || "0"),
        totalUses: parseInt(successPatterns.rows[0]?.total_uses || "0"),
      },
      failurePatterns: {
        count: parseInt(failurePatterns.rows[0]?.count || "0"),
        totalFailures: parseInt(failurePatterns.rows[0]?.total_failures || "0"),
      },
      adaptationRules: {
        avgSuccessRate: parseFloat(rules.rows[0]?.avg_success_rate || "0"),
        totalUses: parseInt(rules.rows[0]?.total_uses || "0"),
      },
    };
  } catch (error) {
    logger.error("AI_LEARNING", "Error getting performance metrics", error as Error);
    return {};
  }
}

/**
 * Initialize learning tables
 */
export async function initializeLearning(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS learning_patterns (
        id SERIAL PRIMARY KEY,
        pattern_type VARCHAR(20) NOT NULL,
        context JSONB,
        action TEXT NOT NULL,
        result JSONB,
        performance DECIMAL(3,2) DEFAULT 0,
        frequency INTEGER DEFAULT 1,
        last_seen TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS adaptation_rules (
        id SERIAL PRIMARY KEY,
        condition JSONB NOT NULL,
        action TEXT NOT NULL,
        priority INTEGER DEFAULT 1,
        enabled BOOLEAN DEFAULT true,
        success_rate DECIMAL(3,2) DEFAULT 0,
        usage_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_learning_patterns_type 
      ON learning_patterns(pattern_type)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_adaptation_rules_enabled 
      ON adaptation_rules(enabled, priority)
    `);
  } catch (error) {
    logger.error("AI_LEARNING", "Error initializing learning", error as Error);
  }
}

// Initialize on module load
if (typeof window === "undefined") {
  initializeLearning();
}

