/**
 * Additional AI Agent Tools
 * Các tools bổ sung cho agent
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { pool } from "@/lib/db";
import { getRole, Role, checkContractExists } from "@/lib/blockchain/contract";

/**
 * Tool: Auto Approve Transfer Requests
 */
export const autoApproveTransferRequestsTool = new DynamicStructuredTool({
  name: "auto_approve_transfer_requests",
  description: "Tự động duyệt transfer requests hợp lệ dựa trên rules",
  schema: z.object({
    rules: z.object({
      requireValidNFT: z.boolean().optional(),
      requireValidDistributor: z.boolean().optional(),
      maxAmount: z.number().optional(),
    }).optional(),
  }),
  func: async ({ rules }) => {
    try {
      const query = `
        SELECT tr.*, n.name as nft_name, n.status as nft_status
        FROM transfer_requests_v2 tr
        JOIN nfts n ON tr.nft_id = n.id
        WHERE tr.status = 'pending'
        ORDER BY tr.created_at ASC
      `;
      
      const result = await pool.query(query);
      const requests = result.rows;
      
      const approved: any[] = [];
      const rejected: any[] = [];
      
      for (const req of requests) {
        try {
          let shouldApprove = true;
          const reasons: string[] = [];
          
          // Check rules
          if (rules?.requireValidNFT && req.nft_status !== 'in_transit') {
            shouldApprove = false;
            reasons.push("NFT không ở trạng thái in_transit");
          }
          
          if (rules?.requireValidDistributor) {
            // Check if distributor has valid role on contract
            try {
              const role = await getRole(req.distributor_address);
              if (role !== Role.DISTRIBUTOR) {
                shouldApprove = false;
                reasons.push("Distributor không có role hợp lệ");
              }
            } catch (contractError: any) {
              console.error("Error checking contract role:", contractError);
              shouldApprove = false;
              reasons.push("Không thể kiểm tra role trên contract");
            }
          }
          
          if (shouldApprove) {
            // Auto approve
            await pool.query(
              `UPDATE transfer_requests_v2 SET status = 'approved', updated_at = NOW() WHERE id = $1`,
              [req.id]
            );
            
            // Update NFT status
            await pool.query(
              `UPDATE nfts SET pharmacy_address = $1, status = 'in_pharmacy' WHERE id = $2`,
              [req.pharmacy_address, req.nft_id]
            );
            
            // Send notification
            await pool.query(
              `INSERT INTO notifications (recipient_address, type, title, message, is_read, created_at)
               VALUES ($1, $2, $3, $4, false, NOW())`,
              [
                req.pharmacy_address.toLowerCase(),
                "transfer_approved",
                "Transfer request đã được tự động duyệt",
                `NFT #${req.nft_id} đã được chuyển từ ${req.distributor_address} sang bạn`,
              ]
            );
            
            approved.push({ id: req.id, nftId: req.nft_id });
          } else {
            rejected.push({ id: req.id, reasons });
          }
        } catch (reqError: any) {
          console.error(`Error processing request ${req.id}:`, reqError);
          rejected.push({ id: req.id, reasons: [`Error: ${reqError.message}`] });
        }
      }
      
      return JSON.stringify({
        success: true,
        approved: approved.length,
        rejected: rejected.length,
        approvedRequests: approved,
        rejectedRequests: rejected,
      });
    } catch (error: any) {
      console.error("Auto approve error:", error);
      return JSON.stringify({ 
        success: false, 
        error: error.message || "Unknown error occurred",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  },
});

/**
 * Tool: Generate Report
 */
export const generateReportTool = new DynamicStructuredTool({
  name: "generate_report",
  description: "Tạo báo cáo tổng hợp về hệ thống",
  schema: z.object({
    reportType: z.enum(["daily", "weekly", "monthly", "custom"]),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
  func: async ({ reportType, startDate, endDate }) => {
    try {
      let dateFilter = "";
      if (startDate && endDate) {
        dateFilter = `WHERE created_at BETWEEN '${startDate}' AND '${endDate}'`;
      } else if (reportType === "daily") {
        dateFilter = "WHERE created_at >= CURRENT_DATE";
      } else if (reportType === "weekly") {
        dateFilter = "WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'";
      } else if (reportType === "monthly") {
        dateFilter = "WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'";
      }
      
      // Get statistics
      const nftsStats = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'CREATED') as created,
          COUNT(*) FILTER (WHERE status = 'in_transit') as in_transit,
          COUNT(*) FILTER (WHERE status = 'in_pharmacy') as in_pharmacy
        FROM nfts ${dateFilter}
      `);
      
      const milestonesStats = await pool.query(`
        SELECT COUNT(*) as total FROM milestones ${dateFilter}
      `);
      
      const transferStats = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'approved') as approved,
          COUNT(*) FILTER (WHERE status = 'pending') as pending
        FROM transfer_requests_v2 ${dateFilter}
      `);
      
      const report = {
        period: reportType,
        dateRange: { startDate, endDate },
        nfts: nftsStats.rows[0],
        milestones: milestonesStats.rows[0],
        transfers: transferStats.rows[0],
        generatedAt: new Date().toISOString(),
      };
      
      return JSON.stringify({
        success: true,
        report,
      });
    } catch (error: any) {
      console.error("Generate report error:", error);
      return JSON.stringify({ 
        success: false, 
        error: error.message || "Unknown error occurred",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  },
});

/**
 * Tool: Check System Health
 */
export const checkSystemHealthTool = new DynamicStructuredTool({
  name: "check_system_health",
  description: "Kiểm tra sức khỏe hệ thống và phát hiện vấn đề",
  schema: z.object({}),
  func: async () => {
    try {
      const issues: any[] = [];
      
      // Check database connection
      try {
        await pool.query("SELECT 1");
      } catch (error) {
        issues.push({ type: "database", severity: "critical", message: "Database connection failed" });
      }
      
      // Check contract connection
      try {
        const { getContractHashFromEnv } = await import("@/lib/blockchain/contract");
        const contractHash = getContractHashFromEnv();
        const exists = await checkContractExists(contractHash);
        if (!exists) {
          issues.push({ type: "contract", severity: "critical", message: "Contract not found at address" });
        }
      } catch (error) {
        issues.push({ type: "blockchain", severity: "warning", message: "Blockchain connection issue" });
      }
      
      // Check stuck NFTs
      const stuckNFTs = await pool.query(`
        SELECT COUNT(*) as count
        FROM nfts n
        LEFT JOIN milestones m ON n.id = m.nft_id
        WHERE n.status = 'in_transit'
        GROUP BY n.id
        HAVING MAX(m.timestamp) < NOW() - INTERVAL '7 days' OR MAX(m.timestamp) IS NULL
      `);
      
      if (stuckNFTs.rows.length > 0) {
        issues.push({
          type: "stuck_nfts",
          severity: "warning",
          message: `${stuckNFTs.rows.length} NFTs stuck in transit`,
        });
      }
      
      const health = {
        status: issues.length === 0 ? "healthy" : issues.some(i => i.severity === "critical") ? "critical" : "warning",
        issues,
        timestamp: new Date().toISOString(),
      };
      
      return JSON.stringify({
        success: true,
        health,
      });
    } catch (error: any) {
      console.error("Check system health error:", error);
      return JSON.stringify({ 
        success: false, 
        error: error.message || "Unknown error occurred",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  },
});

