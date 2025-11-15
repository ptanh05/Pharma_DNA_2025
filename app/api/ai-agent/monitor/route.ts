import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { executeAgentTask } from "@/lib/ai-agent/core";

/**
 * GET /api/ai-agent/monitor
 * Monitor hệ thống và phát hiện vấn đề
 */
export async function GET(req: NextRequest) {
  try {
    const { checkType } = Object.fromEntries(new URL(req.url).searchParams);

    const issues: any[] = [];

    // Check 1: NFTs stuck in transit
    if (!checkType || checkType === "stuck_nfts") {
      const stuckNFTs = await pool.query(
        `SELECT n.*, MAX(m.timestamp) as last_milestone
         FROM nfts n
         LEFT JOIN milestones m ON n.id = m.nft_id
         WHERE n.status = 'in_transit'
         GROUP BY n.id
         HAVING MAX(m.timestamp) < NOW() - INTERVAL '7 days' OR MAX(m.timestamp) IS NULL`
      );

      for (const nft of stuckNFTs.rows) {
        issues.push({
          type: "stuck_nft",
          severity: "warning",
          nftId: nft.id,
          message: `NFT #${nft.id} (${nft.name}) đã bị stuck trong quá trình vận chuyển hơn 7 ngày`,
          action: `Kiểm tra và nhắc nhở distributor ${nft.distributor_address}`,
        });
      }
    }

    // Check 2: NFTs sắp hết hạn
    if (!checkType || checkType === "expiring_nfts") {
      const expiringNFTs = await pool.query(
        `SELECT * FROM nfts 
         WHERE expiry_date < NOW() + INTERVAL '30 days' 
         AND expiry_date > NOW()
         AND status != 'delivered'`
      );

      for (const nft of expiringNFTs.rows) {
        issues.push({
          type: "expiring_nft",
          severity: "warning",
          nftId: nft.id,
          message: `NFT #${nft.id} (${nft.name}) sẽ hết hạn vào ${nft.expiry_date}`,
          action: "Gửi cảnh báo cho tất cả stakeholders",
        });
      }
    }

    // Check 3: Transfer requests sắp hết hạn
    if (!checkType || checkType === "expiring_requests") {
      const expiringRequests = await pool.query(
        `SELECT * FROM transfer_requests_v2
         WHERE status = 'pending'
         AND expires_at < NOW() + INTERVAL '2 hours'
         AND expires_at > NOW()`
      );

      for (const req of expiringRequests.rows) {
        issues.push({
          type: "expiring_request",
          severity: "info",
          requestId: req.id,
          message: `Transfer request #${req.id} sắp hết hạn`,
          action: "Nhắc nhở pharmacy xử lý",
        });
      }
    }

    // Auto-resolve issues if possible
    if (issues.length > 0 && process.env.OPENAI_API_KEY) {
      for (const issue of issues) {
        if (issue.severity === "info" && issue.type === "expiring_request") {
          // Auto-send reminder
          try {
            await executeAgentTask(
              `Gửi thông báo nhắc nhở cho pharmacy ${issue.requestId} về transfer request sắp hết hạn`
            );
          } catch (error) {
            console.error("Auto-resolve error:", error);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      issuesFound: issues.length,
      issues,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Lỗi khi monitor hệ thống",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai-agent/monitor
 * Trigger agent để tự động giải quyết vấn đề
 */
export async function POST(req: NextRequest) {
  try {
    const { issueId, action } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY chưa được cấu hình" },
        { status: 500 }
      );
    }

    // Get issue details
    const issue = await pool.query("SELECT * FROM issues WHERE id = $1", [issueId]);
    if (issue.rows.length === 0) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    const task = `Giải quyết vấn đề: ${JSON.stringify(issue.rows[0])}. Hành động: ${action}`;

    const result = await executeAgentTask(task);

    return NextResponse.json({
      success: true,
      result: result.output,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Lỗi khi giải quyết vấn đề",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

