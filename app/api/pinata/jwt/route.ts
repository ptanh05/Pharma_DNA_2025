import { type NextRequest, NextResponse } from "next/server";
import { logger } from '@/lib/utils/logger';

export async function GET() {
  try {
    // Chỉ trả JWT cho client để upload trực tiếp lên Pinata
    const jwt = process.env.PINATA_JWT;

    if (!jwt) {
      return NextResponse.json(
        { error: "PINATA_JWT chưa được cấu hình" },
        { status: 500 }
      );
    }

    return NextResponse.json({ jwt });
  } catch (error) {
    logger.error('API_PINATA', 'GET jwt error', error);
    return NextResponse.json(
      { error: "Lỗi server" },
      { status: 500 }
    );
  }
}
