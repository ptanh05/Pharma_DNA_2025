/**
 * Admin API - Update User Company Info
 * app/api/admin/users/[address]/route.ts
 *
 * PATCH /api/admin/users/[address]
 * Update company info (company_name, license_number, etc.) for an existing user
 *
 * Security:
 * - Admin auth verified
 * - Rate limited
 * - Address validated and normalized
 * - User existence checked (IDOR protection)
 * - Audit logged
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/middleware/admin-auth";
import { UserRepository } from "@/lib/repositories/user.repository";
import { checkSensitiveActionRateLimit, SENSITIVE_ACTIONS } from "@/lib/security/admin-rate-limit";
import { adminAuditLog, AUDIT_ACTIONS } from "@/lib/security/admin-audit-log";
import { validateAndNormalizeAddress } from "@/lib/security/address-validation";
import { z } from "zod";

const updateUserInfoSchema = z.object({
  company_name: z.string().optional(),
  license_number: z.string().optional(),
  license_ipfs_hash: z.string().optional(),
  tax_id: z.string().optional(),
  contact_email: z.string().optional().refine(
    (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    "Email không hợp lệ"
  ),
  contact_phone: z.string().optional().refine(
    (val) => !val || /^[\d\s\-\+\(\)]{8,15}$/.test(val),
    "Số điện thoại không hợp lệ"
  ),
  company_address: z.string().optional(),
  notes: z.string().optional(),
});

const userRepo = new UserRepository();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  // ── Admin auth verification ───────────────────────────────────────────────
  const adminUser = await verifyAdminToken(req);
  if (!adminUser) {
    return NextResponse.json(
      { success: false, error: "Bạn phải đăng nhập để tiếp tục" },
      { status: 401 }
    );
  }

  const adminId = String(adminUser.id);
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip") ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  // ── Rate limit check ───────────────────────────────────────────────────
  const rateLimitResponse = checkSensitiveActionRateLimit(adminId, SENSITIVE_ACTIONS.UPDATE_USER);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Parse and validate body
    const body = await req.json();
    const parsed = updateUserInfoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Dữ liệu không hợp lệ", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { address } = await params;

    // ── Address validation ────────────────────────────────────────────────
    const addressValidation = validateAndNormalizeAddress(address, { requireChecksum: false });
    if (!addressValidation.valid) {
      return NextResponse.json(
        { success: false, error: addressValidation.error || "Địa chỉ không hợp lệ" },
        { status: 400 }
      );
    }
    const normalizedAddress = addressValidation.address;

    // ── IDOR protection: verify user exists before updating ───────────────
    const existing = await userRepo.findByAddress(normalizedAddress);
    if (!existing) {
      await adminAuditLog.log({
        adminId,
        adminUsername: adminUser.username,
        action: AUDIT_ACTIONS.UPDATE_USER_INFO,
        targetAddress: normalizedAddress,
        ipAddress: clientIP,
        userAgent,
        requestBody: parsed.data,
        responseStatus: 404,
        resultMessage: "Không tìm thấy người dùng",
      }).catch(() => {});
      return NextResponse.json(
        { success: false, error: "Không tìm thấy người dùng" },
        { status: 404 }
      );
    }

    // ── Update company info ────────────────────────────────────────────────
    const updated = await userRepo.updateCompanyInfo(normalizedAddress, parsed.data);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Không có trường nào được cập nhật" },
        { status: 400 }
      );
    }

    // ── Audit log (non-blocking) ─────────────────────────────────────────
    await adminAuditLog.log({
      adminId,
      adminUsername: adminUser.username,
      action: AUDIT_ACTIONS.UPDATE_USER_INFO,
      targetAddress: normalizedAddress,
      targetRole: (existing as any).role,
      ipAddress: clientIP,
      userAgent,
      requestBody: parsed.data,
      responseStatus: 200,
      resultMessage: "Đã cập nhật thông tin người dùng",
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Đã cập nhật thông tin người dùng",
      data: updated,
    });
  } catch (error: any) {
    console.error("[/api/admin/users/[address]] PATCH error:", error);
    await adminAuditLog.log({
      adminId,
      adminUsername: adminUser.username,
      action: AUDIT_ACTIONS.UPDATE_USER_INFO,
      ipAddress: clientIP,
      userAgent,
      responseStatus: 500,
      resultMessage: `Lỗi: ${error.message}`,
    }).catch(() => {});
    return NextResponse.json(
      { success: false, error: error.message || "Lỗi khi cập nhật thông tin" },
      { status: 500 }
    );
  }
}
