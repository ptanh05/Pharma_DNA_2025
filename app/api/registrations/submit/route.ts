/**
 * POST /api/registrations/submit
 * Submit a new role registration (public endpoint)
 */

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { submitRegistrationSchema } from "@/lib/validation/schemas";
import { logInfo } from "@/lib/utils/logger";

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Parse and validate body
    const body = await req.json();
    const validatedData = submitRegistrationSchema.parse(body);

    const walletAddress = validatedData.walletAddress.toLowerCase();
    const requestedRole = validatedData.requestedRole;

    logInfo("Registration submit started", {
      requestId,
      walletAddress,
      requestedRole,
    });

    // Check if this address already has a pending registration for the same role
    const existingCheck = await pool.query(
      `SELECT id FROM role_registrations
       WHERE wallet_address = $1 AND requested_role = $2 AND status = 'pending'`,
      [walletAddress, requestedRole]
    );

    if (existingCheck.rows.length > 0) {
      return NextResponse.json(
        { error: "Địa chỉ này đã có đơn đăng ký vai trò đang chờ duyệt" },
        { status: 409 }
      );
    }

    // Check if address already has this role assigned
    const roleCheck = await pool.query(
      `SELECT role FROM users WHERE address = $1 AND role = $2`,
      [walletAddress, requestedRole]
    );

    if (roleCheck.rows.length > 0) {
      return NextResponse.json(
        { error: `Địa chỉ này đã được cấp vai trò ${requestedRole}` },
        { status: 409 }
      );
    }

    // Build dynamic insert based on role
    const fields: string[] = [
      "wallet_address",
      "requested_role",
      "contact_email",
      "contact_phone",
      "notes",
    ];
    const values: any[] = [
      walletAddress,
      requestedRole,
      validatedData.contactEmail || null,
      validatedData.contactPhone || null,
      validatedData.notes || null,
    ];
    const placeholders: string[] = [];
    let paramIdx = values.length + 1;

    if (requestedRole === "MANUFACTURER") {
      fields.push("company_name", "license_number", "license_ipfs_hash", "tax_id");
      values.push(
        validatedData.companyName,
        validatedData.licenseNumber,
        validatedData.licenseIpfsHash,
        validatedData.taxId || null
      );
      placeholders.push(...["$" + paramIdx++, "$" + paramIdx++, "$" + paramIdx++, "$" + paramIdx++]);
    } else if (requestedRole === "DISTRIBUTOR") {
      fields.push("distributor_name", "license_number", "license_ipfs_hash", "distributor_address");
      values.push(
        validatedData.distributorName,
        validatedData.licenseNumber,
        validatedData.licenseIpfsHash,
        validatedData.distributorAddress
      );
      placeholders.push(...["$" + paramIdx++, "$" + paramIdx++, "$" + paramIdx++, "$" + paramIdx++]);
    } else if (requestedRole === "PHARMACY") {
      fields.push("pharmacy_name", "license_number", "license_ipfs_hash", "pharmacy_address");
      values.push(
        validatedData.pharmacyName,
        validatedData.licenseNumber,
        validatedData.licenseIpfsHash,
        validatedData.pharmacyAddress
      );
      placeholders.push(...["$" + paramIdx++, "$" + paramIdx++, "$" + paramIdx++, "$" + paramIdx++]);
    }

    const insertQuery = `
      INSERT INTO role_registrations (${fields.join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING id, wallet_address, requested_role, status, created_at
    `;

    const result = await pool.query(insertQuery, values);
    const row = result.rows[0];

    logInfo("Registration submitted successfully", {
      requestId,
      registrationId: row.id,
      walletAddress,
      requestedRole,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          registrationId: row.id,
          walletAddress: row.wallet_address,
          requestedRole: row.requested_role,
          status: row.status,
          createdAt: row.created_at,
        },
        message: "Đơn đăng ký đã được gửi thành công. Vui lòng chờ admin duyệt.",
      },
      { status: 201 }
    );
  } catch (error: any) {
    logInfo("Registration submit failed", {
      requestId,
      error: error.message,
      durationMs: Date.now() - startTime,
    });

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Dữ liệu không hợp lệ", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Gửi đơn thất bại" },
      { status: 500 }
    );
  }
}