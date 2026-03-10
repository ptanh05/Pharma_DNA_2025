/**
 * Distributor API - Transfer to Pharmacy
 * app/api/distributor/transfer-to-pharmacy/route.ts
 */

import { NextRequest } from "next/server";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { pool } from "@/lib/db";
import { z }from "zod";

const transferRequestSchema = z.object({
  nft_id: z.number().int().positive("NFT ID is required"),
  pharmacy_address: z.string().min(1, "Pharmacy address is required"),
  transfer_note: z.string().optional(),
});

const updateSchema = z.object({
  request_id: z.number().int().positive(),
  status: z.enum(["approved", "rejected"]),
  pharmacy_address: z.string().optional(),
});

const deleteSchema = z.object({
  request_id: z.number().int().positive(),
});

/**
 * GET /api/distributor/transfer-to-pharmacy
 * Get transfer requests
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const distributor_address = searchParams.get("distributor_address");
    const pharmacy_address = searchParams.get("pharmacy_address");
    const status = searchParams.get("status");

    // Create table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transfer_requests (
        id SERIAL PRIMARY KEY,
        nft_id INTEGER NOT NULL,
        distributor_address VARCHAR(100) NOT NULL,
        pharmacy_address VARCHAR(100) NOT NULL,
        transfer_note TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    let query = "SELECT * FROM transfer_requests WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 1;

    if (distributor_address) {
      query += ` AND LOWER(distributor_address) = LOWER($${paramIndex})`;
      params.push(distributor_address);
      paramIndex++;
    }

    if (pharmacy_address) {
      query += ` AND LOWER(pharmacy_address) = LOWER($${paramIndex})`;
      params.push(pharmacy_address);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += " ORDER BY created_at DESC LIMIT 50";

    console.log("[GET Transfer Requests] Query:", query, "Params:", params);
    const result = await pool.query(query, params);
    console.log("[GET Transfer Requests] Results:", result.rows.length);
    return createSuccessResponse(result.rows);
  } catch (error: any) {
    console.error("[GET Transfer Requests] Error:", error);
    return createErrorResponse(error, "GET_TRANSFER_REQUESTS");
  }
}

/**
 * POST /api/distributor/transfer-to-pharmacy
 * Create transfer request
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[POST Transfer Request] Body:", body);
    const { nft_id, pharmacy_address, transfer_note } = transferRequestSchema.parse(body);

    // Get distributor address from header
    const distributorAddress = req.headers.get("x-distributor-address")?.toLowerCase();
    console.log("[POST Transfer Request] Distributor:", distributorAddress);
    if (!distributorAddress) {
      return createErrorResponse(new Error("Distributor address required"), "TRANSFER_REQUEST");
    }

    // Check if NFT exists and is at distributor
    const nftQuery = "SELECT * FROM nfts WHERE id = $1 AND distributor_address = $2 AND status = 'at_distributor'";
    const nftResult = await pool.query(nftQuery, [nft_id, distributorAddress]);
    console.log("[POST Transfer Request] NFT check:", nftResult.rows.length);

    if (nftResult.rows.length === 0) {
      return createErrorResponse(new Error("NFT not found or not at distributor"), "TRANSFER_REQUEST");
    }

    // Check if there's already a pending request
    const existingQuery = "SELECT * FROM transfer_requests WHERE nft_id = $1 AND status = 'pending'";
    const existingResult = await pool.query(existingQuery, [nft_id]);

    if (existingResult.rows.length > 0) {
      return createErrorResponse(new Error("There's already a pending transfer request for this NFT"), "TRANSFER_REQUEST");
    }

    // Create transfer request
    const insertQuery = `
      INSERT INTO transfer_requests (nft_id, distributor_address, pharmacy_address, transfer_note, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())
      RETURNING *
    `;
    const insertResult = await pool.query(insertQuery, [
      nft_id,
      distributorAddress,
      pharmacy_address.toLowerCase(),
      transfer_note || null,
    ]);
    console.log("[POST Transfer Request] Created:", insertResult.rows[0]);

    return createSuccessResponse({
      request: insertResult.rows[0],
      message: "Transfer request created successfully",
    });
  }catch (error: any) {
    console.error("[POST Transfer Request] Error:", error);
    return createErrorResponse(error, "DISTRIBUTOR_TRANSFER");
  }
}

/**
 * PUT /api/distributor/transfer-to-pharmacy
 * Update transfer request status (approve/reject)
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { request_id, status, pharmacy_address } = updateSchema.parse(body);

    // Get current request
    const getQuery = "SELECT * FROM transfer_requests WHERE id = $1";
    const getResult = await pool.query(getQuery, [request_id]);

    if (getResult.rows.length === 0) {
      return createErrorResponse(new Error("Transfer request not found"), "UPDATE_TRANSFER");
    }

    const currentRequest = getResult.rows[0];

    // Update status
    const updateQuery = `
      UPDATE transfer_requests
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(updateQuery, [status, request_id]);

    // If approved, update NFT status to in_transit
    if (status === "approved") {
      await pool.query(
        `UPDATE nfts SET status = 'in_transit', updated_at = NOW() WHERE id = $1`,
        [currentRequest.nft_id]
      );
    }

    return createSuccessResponse({
      request: result.rows[0],
      message: `Transfer request ${status}`,
    });
  } catch (error: any) {
    return createErrorResponse(error, "UPDATE_TRANSFER");
  }
}

/**
 * DELETE /api/distributor/transfer-to-pharmacy
 * Cancel transfer request
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { request_id } = deleteSchema.parse(body);

    // Check if request exists and is pending
    const getQuery = "SELECT * FROM transfer_requests WHERE id = $1 AND status = 'pending'";
    const getResult = await pool.query(getQuery, [request_id]);

    if (getResult.rows.length === 0) {
      return createErrorResponse(new Error("Cannot cancel - request not found or not pending"), "DELETE_TRANSFER");
    }

    // Update status to cancelled
    const updateQuery = `
      UPDATE transfer_requests
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(updateQuery, [request_id]);

    return createSuccessResponse({
      request: result.rows[0],
      message: "Transfer request cancelled",
    });
  } catch (error: any) {
    return createErrorResponse(error, "DELETE_TRANSFER");
  }
}
