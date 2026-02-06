/**
 * Pharmacy API - Get Inventory
 * app/api/pharmacy/inventory/route.ts
 */

import { NextRequest } from "next/server";
import { pharmacyService }from "@/lib/services/pharmacy.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateQueryParams }from "@/lib/utils/api-validator";
import { z } from "zod";

const inventoryQuerySchema = z.object({
  address: z.string().min(1, "Address is required"),
  page: z.string().default("1").transform(Number),
  limit: z.string().default("10").transform(Number),
});

/**
 * GET /api/pharmacy/inventory
 * Get pharmacy inventory
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { address, page, limit }= validateQueryParams(searchParams, inventoryQuerySchema);

    const result = await pharmacyService.getPharmacyInventory(address, page, limit);

    return createSuccessResponse(result);
  }catch (error: any) {
    return createErrorResponse(error, "PHARMACY_GET_INVENTORY");
  }
}

