/**
 * Admin Report Export API
 * app/api/export/admin-report/route.ts
 */

import { NextRequest } from "next/server";
import { exportService } from "@/lib/services/export.service";

/**
 * GET /api/export/admin-report?format=csv|json
 * Export full admin report: NFTs, users, and stats
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json";

    const report = await exportService.exportAdminReport();

    if (format === "csv") {
      // Export NFTs as CSV
      const csv = exportService.toCSV(report.nfts);
      const timestamp = new Date().toISOString().split("T")[0];
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="pharma-nft-report-${timestamp}.csv"`,
        },
      });
    }

    // Default: JSON
    const timestamp = new Date().toISOString().split("T")[0];
    return new Response(JSON.stringify(report, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="pharma-admin-report-${timestamp}.json"`,
      },
    });
  } catch (error: any) {
    return Response.json(
      { success: false, error: error.message || "Failed to export report" },
      { status: 500 }
    );
  }
}
