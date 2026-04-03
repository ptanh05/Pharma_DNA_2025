/**
 * Onboarding API Route
 * Returns onboarding status and checklist for the user
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          address: address.toLowerCase(),
          steps: [
            {
              id: "wallet_connected",
              label: "Kết nối ví",
              completed: true,
              description: "Đã kết nối ví thành công",
            },
            {
              id: "role_assigned",
              label: "Được cấp vai trò",
              completed: false,
              description: "Chờ admin cấp vai trò trong hệ thống",
            },
            {
              id: "nft_minted",
              label: "Tạo NFT đầu tiên",
              completed: false,
              description: "Tạo lô thuốc NFT đầu tiên (chỉ dành cho Manufacturer)",
            },
            {
              id: "transfer_complete",
              label: "Hoàn tất vận chuyển",
              completed: false,
              description: "Hoàn tất quy trình vận chuyển NFT",
            },
          ],
          currentStep: "role_assigned",
          message:
            "Chào mừng bạn đến với PharmaDNA! Vui lòng liên hệ admin để được cấp vai trò.",
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address } = body;

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          address: address.toLowerCase(),
          registered: true,
          registeredAt: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
