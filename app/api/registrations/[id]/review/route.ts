/**
 * POST /api/registrations/[id]/review
 * Review (approve/reject) a role registration (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { reviewRegistrationSchema } from "@/lib/validation/schemas";
import { logger } from "@/lib/utils/logger";
import { RoleService } from "@/lib/services/role.service";
import { UserRepository } from "@/lib/repositories/user.repository";

const userRepo = new UserRepository();
const roleService = new RoleService(userRepo);

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const { id } = await context.params;
    const registrationId = parseInt(id, 10);

    if (isNaN(registrationId)) {
      return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
    }

    // Parse and validate body
    const body = await req.json();
    const validatedData = reviewRegistrationSchema.parse(body);
    const { status, rejectionReason } = validatedData;

    logger.info("REVIEW_REGISTRATION", "Review registration started", {
      requestId,
      registrationId,
      status,
    });

    // Get registration
    const regResult = await pool.query(
      `SELECT id, wallet_address, requested_role, status
       FROM role_registrations WHERE id = $1`,
      [registrationId]
    );

    if (regResult.rows.length === 0) {
      return NextResponse.json({ error: "Không tìm thấy đơn đăng ký" }, { status: 404 });
    }

    const registration = regResult.rows[0];

    if (registration.status !== "pending") {
      return NextResponse.json(
        { error: "Đơn này đã được xử lý trước đó" },
        { status: 409 }
      );
    }

    // Get admin address from auth header
    const authHeader = req.headers.get("authorization");
    let reviewedBy = "admin";
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const decoded = JSON.parse(Buffer.from(token, "base64").toString());
        reviewedBy = decoded?.address || decoded?.username || "admin";
      } catch {
        reviewedBy = "admin";
      }
    }

    if (status === "approved") {
      // Assign role on blockchain + DB
      try {
        const assignResult = await roleService.assignRole({
          address: registration.wallet_address,
          role: registration.requested_role,
        });

        if (!assignResult.success) {
          logger.error("REVIEW_REGISTRATION", "Blockchain role assignment failed", {
            requestId,
            registrationId,
            walletAddress: registration.wallet_address,
            requestedRole: registration.requested_role,
          });

          return NextResponse.json(
            { error: `Cấp quyền blockchain thất bại: ${assignResult.error}` },
            { status: 500 }
          );
        }

        // Update registration record
        await pool.query(
          `UPDATE role_registrations
           SET status = 'approved',
               reviewed_by = $1,
               reviewed_at = NOW(),
               blockchain_tx = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [reviewedBy, assignResult.transactionHash || null, registrationId]
        );

        logger.info("REVIEW_REGISTRATION", "Registration approved", {
          requestId,
          registrationId,
          walletAddress: registration.wallet_address,
          requestedRole: registration.requested_role,
          blockchainTx: assignResult.transactionHash,
          durationMs: Date.now() - startTime,
        });

        return NextResponse.json({
          success: true,
          message: "Duyệt đơn thành công. Vai trò đã được cấp trên blockchain.",
          data: {
            registrationId,
            status: "approved",
            blockchainTx: assignResult.transactionHash,
            explorerUrl: assignResult.explorerUrl,
          },
        });
      } catch (blockchainError: any) {
        logger.error("REVIEW_REGISTRATION", "Blockchain review error", blockchainError, {
          requestId,
          registrationId,
        });

        return NextResponse.json(
          { error: `Lỗi blockchain: ${blockchainError.message}` },
          { status: 500 }
        );
      }
    } else {
      // Reject
      await pool.query(
        `UPDATE role_registrations
         SET status = 'rejected',
             reviewed_by = $1,
             reviewed_at = NOW(),
             rejection_reason = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [reviewedBy, rejectionReason || null, registrationId]
      );

      logger.info("REVIEW_REGISTRATION", "Registration rejected", {
        requestId,
        registrationId,
        walletAddress: registration.wallet_address,
        rejectionReason,
        durationMs: Date.now() - startTime,
      });

      return NextResponse.json({
        success: true,
        message: "Đã từ chối đơn đăng ký",
        data: {
          registrationId,
          status: "rejected",
          rejectionReason,
        },
      });
    }
  } catch (error: any) {
    logger.error("REVIEW_REGISTRATION", "Review registration failed", error, { requestId });

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Dữ liệu không hợp lệ", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Xử lý thất bại" },
      { status: 500 }
    );
  }
}
