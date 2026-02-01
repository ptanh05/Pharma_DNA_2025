import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { mintProductNFT, transferProductNFT } from "@/lib/blockchain/contract";

export const dynamic = "force-dynamic";

async function ensureOnchainProposalsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS onchain_proposals (
      id SERIAL PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      proposal_data JSONB NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_by VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      executed_at TIMESTAMPTZ,
      transaction_digest VARCHAR(255)
    )
  `);
}

export async function GET() {
  try {
    await ensureOnchainProposalsTable();
    const { rows } = await pool.query(
      `SELECT id, type, proposal_data, status, created_by, created_at, executed_at, transaction_digest
       FROM onchain_proposals
       ORDER BY created_at DESC
       LIMIT 100`
    );

    return NextResponse.json({ success: true, proposals: rows });
  } catch (error: any) {
    console.error("GET /api/ai-agent/proposals error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch proposals" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureOnchainProposalsTable();
    const body = await req.json();
    const { id, action } = body as { id?: number; action?: "approve" | "reject" };

    if (!id || !action) {
      return NextResponse.json(
        { success: false, error: "Thiếu id hoặc action" },
        { status: 400 }
      );
    }

    const { rows } = await pool.query(
      `SELECT * FROM onchain_proposals WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Proposal không tồn tại" },
        { status: 404 }
      );
    }

    const proposal = rows[0] as {
      id: number;
      type: string;
      proposal_data: any;
      status: string;
    };

    if (proposal.status !== "pending") {
      return NextResponse.json(
        { success: false, error: "Proposal đã được xử lý" },
        { status: 400 }
      );
    }

    if (action === "reject") {
      await pool.query(
        `UPDATE onchain_proposals SET status = 'rejected', executed_at = NOW() WHERE id = $1`,
        [id]
      );
      return NextResponse.json({
        success: true,
        message: "Đã từ chối proposal",
      });
    }

    // APPROVE & EXECUTE
    if (!process.env.OWNER_PRIVATE_KEY) {
      return NextResponse.json(
        {
          success: false,
          error:
            "OWNER_PRIVATE_KEY chưa được cấu hình, không thể thực thi transaction on-chain",
        },
        { status: 500 }
      );
    }

    let txDigest: string | undefined;

    if (proposal.type === "mint") {
      const { ipfsHash, manufacturerAddress, batchNumber, expiryDate } =
        proposal.proposal_data || {};

      if (!ipfsHash || !manufacturerAddress || !batchNumber || !expiryDate) {
        return NextResponse.json(
          { success: false, error: "Dữ liệu proposal mint không hợp lệ" },
          { status: 400 }
        );
      }

      const result = await mintProductNFT(
        ipfsHash,
        batchNumber,
        expiryDate,
        process.env.OWNER_PRIVATE_KEY
      );

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || "Mint transaction failed",
          },
          { status: 500 }
        );
      }

      txDigest = result.digest;
    } else if (proposal.type === "transfer") {
      const { tokenId, toAddress } = proposal.proposal_data || {};

      if (!tokenId || !toAddress) {
        return NextResponse.json(
          { success: false, error: "Dữ liệu proposal transfer không hợp lệ" },
          { status: 400 }
        );
      }

      const result = await transferProductNFT(
        String(tokenId),
        toAddress,
        process.env.OWNER_PRIVATE_KEY
      );

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || "Transfer transaction failed",
          },
          { status: 500 }
        );
      }

      txDigest = result.digest;
    } else {
      return NextResponse.json(
        { success: false, error: `Loại proposal không hỗ trợ: ${proposal.type}` },
        { status: 400 }
      );
    }

    await pool.query(
      `UPDATE onchain_proposals
       SET status = 'executed',
           executed_at = NOW(),
           transaction_digest = $2
       WHERE id = $1`,
      [id, txDigest || null]
    );

    return NextResponse.json({
      success: true,
      message: "Đã thực thi proposal on-chain thành công",
      transactionDigest: txDigest,
    });
  } catch (error: any) {
    console.error("POST /api/ai-agent/proposals error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process proposal" },
      { status: 500 }
    );
  }
}


