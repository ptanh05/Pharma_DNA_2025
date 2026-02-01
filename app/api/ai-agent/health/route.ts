import { NextRequest, NextResponse } from "next/server";

// FIXED: Force dynamic rendering to prevent SSG/prerender
export const dynamic = 'force-dynamic';

/**
 * GET /api/ai-agent/health
 * Kiểm tra sức khỏe hệ thống
 */
export async function GET(req: NextRequest) {
  try {
    // Check if OpenAI API key is configured
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    
    // Simple health check without executing agent task (to avoid import errors)
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
      console.error('Database health check failed:', dbError.message);
    }

    // Check blockchain config
    try {
      const { getSuiClient } = await import('@/lib/blockchain/provider-sui');
      const client = getSuiClient();
      await client.getLatestSuiSystemState();
      health.services.blockchain = 'connected';
    } catch (blockchainError: any) {
      health.services.blockchain = 'error';
      console.error('Blockchain health check failed:', blockchainError.message);
    }

    return NextResponse.json({
      success: true,
      health,
    });
  } catch (error: any) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: "Lỗi khi kiểm tra sức khỏe hệ thống",
        detail: error.message,
        health: {
          status: 'error',
          timestamp: new Date().toISOString(),
        }
      },
      { status: 200 } // Return 200 with error in body instead of 500
    );
  }
}

