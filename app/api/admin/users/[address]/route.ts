/**
 * Admin API - Update User Company Info
 * app/api/admin/users/[address]/route.ts
 *
 * PATCH /api/admin/users/[address]
 * Update company info (company_name, license_number, etc.) for an existing user
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/middleware/admin-auth";
import { UserRepository } from "@/lib/repositories/user.repository";
import { z } from "zod";

const updateUserInfoSchema = z.object({
  company_name: z.string().optional(),
  license_number: z.string().optional(),
  license_ipfs_hash: z.string().optional(),
  tax_id: z.string().optional(),
  contact_email: z.string().optional(),
  contact_phone: z.string().optional(),
  company_address: z.string().optional(),
  notes: z.string().optional(),
});

const userRepo = new UserRepository();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    // Verify admin token
    const adminToken = verifyAdminToken(req);
    if (!adminToken) {
      return NextResponse.json(
        { success: false, error: "Bạn phải đăng nhập để tiếp tục" },
        { status: 401 }
      );
    }

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
    const normalizedAddress = address.toLowerCase();

    // Check if user exists
    const existing = await userRepo.findByAddress(normalizedAddress);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy người dùng" },
        { status: 404 }
      );
    }

    // Update company info
    const updated = await userRepo.updateCompanyInfo(normalizedAddress, parsed.data);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Không có trường nào được cập nhật" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Đã cập nhật thông tin người dùng",
      data: updated,
    });
  } catch (error: any) {
    console.error("[/api/admin/users/[address]] PATCH error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Lỗi khi cập nhật thông tin" },
      { status: 500 }
    );
  }
}
