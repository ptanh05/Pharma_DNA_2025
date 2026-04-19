import { NextRequest } from "next/server";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { getClientIP } from "@/lib/utils/api-validator";
import { logger } from '@/lib/utils/logger';

// FIXED: Force dynamic rendering to prevent SSG/prerender
export const dynamic = 'force-dynamic';

/**
 * GET /api/ai-agent/health
 * Kiểm tra sức khỏe hệ thống
 */
export async function GET(req: NextRequest) {
  try {
    const clientIP = getClientIP(req);
    
    // Check if OpenAI API key is configured
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    
    // Simple health check without executing agent task
    const health = {
      status: 'ok',
      openaiConfigured: hasOpenAIKey,
      timestamp: new Date().toISOString(),
      services: {
        database: 'unknown',
        blockchain: 'unknown',
      }
    };

    // Check database connection
    try {
      const { pool } = await import('@/lib/db');
      await pool.query('SELECT 1');
      health.services.database = 'connected';
    } catch (dbError: any) {
      health.services.database = 'error';
      logger.error('API_AI_AGENT', 'Database health check failed', dbError);
    }

    // Check blockchain config
    try {
      const { getSuiClient }= await import('@/lib/blockchain/provider-sui');
      const client = getSuiClient();
      await client.getLatestSuiSystemState();
      health.services.blockchain = 'connected';
    }catch (blockchainError: any) {
      health.services.blockchain = 'error';
      logger.error('API_AI_AGENT', 'Blockchain health check failed', blockchainError);
    }

    return createSuccessResponse(health);
  } catch (error: any) {
    return createErrorResponse(error, 'AI_AGENT_HEALTH');
  }
}
