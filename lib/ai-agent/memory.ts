/**
 * Memory Management for AI Agent
 * Lưu conversation history và context
 */

import { pool } from "@/lib/db";
import { logger } from "@/lib/utils/logger";

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: any;
}

export interface AgentMemory {
  sessionId: string;
  messages: ConversationMessage[];
  context: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const memoryStore = new Map<string, AgentMemory>();

/**
 * Get or create memory for session
 */
export function getMemory(sessionId: string): AgentMemory {
  if (!memoryStore.has(sessionId)) {
    memoryStore.set(sessionId, {
      sessionId,
      messages: [],
      context: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  return memoryStore.get(sessionId)!;
}

/**
 * Add message to memory
 */
export function addMessage(
  sessionId: string,
  role: "user" | "assistant" | "system",
  content: string,
  metadata?: any
): void {
  const memory = getMemory(sessionId);
  memory.messages.push({
    role,
    content,
    timestamp: new Date(),
    metadata,
  });
  memory.updatedAt = new Date();

  // Keep only last 50 messages
  if (memory.messages.length > 50) {
    memory.messages = memory.messages.slice(-50);
  }
}

/**
 * Update context
 */
export function updateContext(sessionId: string, context: Record<string, any>): void {
  const memory = getMemory(sessionId);
  memory.context = { ...memory.context, ...context };
  memory.updatedAt = new Date();
}

/**
 * Get recent messages for context
 */
export function getRecentMessages(sessionId: string, limit: number = 10): ConversationMessage[] {
  const memory = getMemory(sessionId);
  return memory.messages.slice(-limit);
}

/**
 * Save memory to database (optional)
 */
export async function saveMemoryToDB(sessionId: string): Promise<void> {
  try {
    const memory = getMemory(sessionId);
    
    // Create table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_memory (
        session_id VARCHAR(100) PRIMARY KEY,
        messages JSONB,
        context JSONB,
        created_at TIMESTAMP,
        updated_at TIMESTAMP
      )
    `);

    // Upsert memory
    await pool.query(
      `INSERT INTO agent_memory (session_id, messages, context, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (session_id) DO UPDATE
       SET messages = $2, context = $3, updated_at = $5`,
      [
        sessionId,
        JSON.stringify(memory.messages),
        JSON.stringify(memory.context),
        memory.createdAt,
        memory.updatedAt,
      ]
    );
  } catch (error) {
    logger.error("AI_MEMORY", "Error saving memory to DB", error as Error);
    // Don't throw, memory is optional
  }
}

/**
 * Load memory from database
 */
export async function loadMemoryFromDB(sessionId: string): Promise<AgentMemory | null> {
  try {
    const result = await pool.query(
      "SELECT * FROM agent_memory WHERE session_id = $1",
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const memory: AgentMemory = {
      sessionId,
      messages: row.messages || [],
      context: row.context || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    memoryStore.set(sessionId, memory);
    return memory;
  } catch (error) {
    logger.error("AI_MEMORY", "Error loading memory from DB", error as Error);
    return null;
  }
}

// Cleanup old memories periodically
// Note: setInterval doesn't work in Vercel serverless
if (typeof process !== "undefined" && process.env.VERCEL !== "1") {
  setInterval(() => {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [sessionId, memory] of memoryStore.entries()) {
      if (now - memory.updatedAt.getTime() > maxAge) {
        memoryStore.delete(sessionId);
      }
    }
  }, 60 * 60 * 1000); // Run every hour
}

// Cleanup function for serverless (call on-demand)
export function cleanupMemory(): void {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  for (const [sessionId, memory] of memoryStore.entries()) {
    if (now - memory.updatedAt.getTime() > maxAge) {
      memoryStore.delete(sessionId);
    }
  }
}

