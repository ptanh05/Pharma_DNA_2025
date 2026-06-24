/**
 * Onboarding API Route
 * Returns onboarding status and checklist for the user
 * Queries the database to determine real completion state
 */
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

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

    const normalizedAddress = address.toLowerCase();

    // 1. Check user role from database
    const userResult = await pool.query(
      "SELECT address, role, assigned_at FROM users WHERE address = $1",
      [normalizedAddress]
    );
    const user = userResult.rows[0] || null;
    const hasRole = !!user?.role;
    const role = user?.role || null;

    // 2. Check if user has minted any NFTs
    let hasMintedNft = false;
    if (hasRole && role === "MANUFACTURER") {
      const nftResult = await pool.query(
        "SELECT COUNT(*) FROM nfts WHERE manufacturer_address = $1",
        [normalizedAddress]
      );
      hasMintedNft = parseInt(nftResult.rows[0]?.count || "0", 10) > 0;
    }

    // 3. Check if user has completed a transfer
    let hasTransfer = false;
    if (hasRole) {
      if (role === "MANUFACTURER") {
        // Manufacturer: check if any of their NFTs has been transferred
        const transferResult = await pool.query(
          `SELECT COUNT(*) FROM transfer_requests tr
           JOIN nfts n ON n.id = tr.nft_id
           WHERE n.manufacturer_address = $1
           AND tr.status IN ('approved', 'completed')`,
          [normalizedAddress]
        );
        hasTransfer = parseInt(transferResult.rows[0]?.count || "0", 10) > 0;
      } else if (role === "DISTRIBUTOR") {
        const transferResult = await pool.query(
          "SELECT COUNT(*) FROM transfer_requests WHERE distributor_address = $1 AND status IN ('approved', 'completed')",
          [normalizedAddress]
        );
        hasTransfer = parseInt(transferResult.rows[0]?.count || "0", 10) > 0;
      } else if (role === "PHARMACY") {
        const transferResult = await pool.query(
          "SELECT COUNT(*) FROM transfer_requests WHERE pharmacy_address = $1 AND status IN ('approved', 'completed')",
          [normalizedAddress]
        );
        hasTransfer = parseInt(transferResult.rows[0]?.count || "0", 10) > 0;
      }
    }

    // Build steps based on real database state
    const walletConnected = true; // User reached this page, wallet is connected

    const steps = [
      {
        id: "wallet_connected",
        label: "Kết nối ví",
        completed: walletConnected,
        description: "Đã kết nối ví thành công",
      },
      {
        id: "role_assigned",
        label: "Được cấp vai trò",
        completed: hasRole,
        description: hasRole
          ? `Vai trò: ${role}`
          : "Chờ admin cấp vai trò trong hệ thống",
      },
      {
        id: "nft_minted",
        label: "Tạo NFT đầu tiên",
        completed: hasMintedNft,
        description: hasMintedNft
          ? "Đã tạo NFT lô thuốc thành công"
          : role === "MANUFACTURER"
            ? "Tạo lô thuốc NFT đầu tiên"
            : `Không áp dụng cho vai trò ${role || "chưa được cấp"}`,
      },
      {
        id: "transfer_complete",
        label: "Hoàn tất vận chuyển",
        completed: hasTransfer,
        description: hasTransfer
          ? "Đã hoàn tất quy trình vận chuyển"
          : "Hoàn tất quy trình vận chuyển NFT",
      },
    ];

    // Determine current step
    let currentStep = "wallet_connected";
    if (walletConnected && !hasRole) {
      currentStep = "role_assigned";
    } else if (hasRole && role === "MANUFACTURER" && !hasMintedNft) {
      currentStep = "nft_minted";
    } else if ((hasRole && hasMintedNft) || (hasRole && role !== "MANUFACTURER")) {
      currentStep = "transfer_complete";
    }
    if (hasTransfer) {
      currentStep = "complete";
    }

    // Build welcome message
    let message = "Chào mừng bạn đến với PharmaDNA!";
    if (!hasRole) {
      message += " Vui lòng liên hệ admin để được cấp vai trò.";
    } else if (role === "MANUFACTURER" && !hasMintedNft) {
      message += " Hãy tạo NFT cho lô thuốc đầu tiên của bạn.";
    } else if (!hasTransfer) {
      message += " Hãy hoàn tất quy trình vận chuyển đầu tiên.";
    } else {
      message += " Bạn đã hoàn tất tất cả các bước onboarding!";
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          address: normalizedAddress,
          role: role,
          hasRole,
          hasMintedNft,
          hasTransfer,
          steps,
          currentStep,
          message,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[Onboarding API] Error:", error);
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

    const normalizedAddress = address.toLowerCase();

    // Check if user already exists
    const existing = await pool.query(
      "SELECT address FROM users WHERE address = $1",
      [normalizedAddress]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "User already registered",
          data: existing.rows[0],
        },
        { status: 409 }
      );
    }

    // Insert new user registration
    const result = await pool.query(
      "INSERT INTO users (address) VALUES ($1) RETURNING address",
      [normalizedAddress]
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          address: result.rows[0].address,
          registered: true,
          registeredAt: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[Onboarding POST] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
