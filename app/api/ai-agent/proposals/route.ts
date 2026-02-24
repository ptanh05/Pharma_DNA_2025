import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateQueryParams }from "@/lib/utils/api-validator";
import { z } from "zod";

// FIXED: Force dynamic rendering
export const dynamic = 'force-dynamic';

const proposalsQuerySchema = z.object({
  status: z.enum(['pending', 'executed', 'rejected']).optional(),
  limit: z.string().default("10").transform(Number),
  offset: z.string().default("0").transform(Number),
});

/**
 * GET /api/ai-agent/proposals
 * Get on-chain proposals
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { status, limit, offset }= validateQueryParams(searchParams, proposalsQuerySchema);

    let query = "SELECT * FROM onchain_proposals";
    const params: any[] = [];
    const conditions: string[] = [];

    if (status) {
      conditions.push(`status = $${conditions.length + 1}`);
      params.push(status);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = "SELECT COUNT(*) as total FROM onchain_proposals";
    if (conditions.length > 0) {
      countQuery += " WHERE " + conditions.join(" AND ");
    }
    const countResult = await pool.query(
      countQuery,
      params.slice(0, conditions.length)
    );

    return createSuccessResponse({
      proposals: result.rows,
      total: parseInt(countResult.rows[0]?.total || "0"),
      limit,
      offset,
    });
  } catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_PROPOSALS");
  }
}

/**
 * POST /api/ai-agent/proposals
 * Create a new on-chain proposal
 */
export async function POST(req: NextRequest) {
  try {
    const { type, proposalData } = await req.json();

    if (!type || !proposalData) {
      return createErrorResponse(
        new Error("type and proposalData are required"),
        "AI_AGENT_PROPOSALS"
      );
    }

    const result = await pool.query(
      `INSERT INTO onchain_proposals (type, proposal_data, status, created_by, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [type, JSON.stringify(proposalData), 'pending', process.env.OWNER_ADDRESS || 'system']
    );

    return createSuccessResponse(result.rows[0]);
  } catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_PROPOSALS");
  }
}
