/**
 * API Route: POST /api/distributor/upload-sensor
 * Upload AIoT sensor data (temperature, humidity, GPS, etc.) for an NFT
 *
 * Body (FormData):
 *   - sensorData: JSON file with sensor readings
 *   - nftId: NFT identifier
 *   - distributorAddress: distributor wallet address
 */

import { NextRequest, NextResponse } from "next/server";
import { authorizeRole, UnauthorizedError, ForbiddenError } from "@/lib/middleware/auth";
import { pool } from "@/lib/db";
import { logInfo, logError } from "@/lib/logger";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const sensorDataSchema = z.object({
  temperature: z.number().optional(),
  humidity: z.number().optional(),
  gps_lat: z.number().optional(),
  gps_lng: z.number().optional(),
  gps_location: z.string().optional(),
  timestamp: z.string().optional(),
  additional_data: z.record(z.any()).optional(),
});

/**
 * POST /api/distributor/upload-sensor
 */
export async function POST(req: NextRequest) {
  const requestId = uuidv4();

  try {
    // Step 1: Authenticate distributor
    let user;
    try {
      user = await authorizeRole(req, "DISTRIBUTOR");
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          { success: false, error: "Bạn phải đăng nhập để tiếp tục" },
          { status: 401 }
        );
      }
      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          { success: false, error: "Chỉ Distributor mới có thể upload dữ liệu cảm biến" },
          { status: 403 }
        );
      }
      throw error;
    }

    // Step 2: Parse form data
    const formData = await req.formData();
    const sensorDataFile = formData.get("sensorData");
    const nftId = formData.get("nftId");
    const distributorAddress = formData.get("distributorAddress");

    if (!sensorDataFile || !(sensorDataFile instanceof File)) {
      return NextResponse.json(
        { success: false, error: "File dữ liệu cảm biến là bắt buộc" },
        { status: 400 }
      );
    }

    if (!nftId) {
      return NextResponse.json(
        { success: false, error: "nftId là bắt buộc" },
        { status: 400 }
      );
    }

    // Step 3: Parse sensor data from JSON file
    let sensorData: z.infer<typeof sensorDataSchema>;
    try {
      const text = await sensorDataFile.text();
      const parsed = JSON.parse(text);
      sensorData = sensorDataSchema.parse(parsed);
    } catch (parseError: any) {
      return NextResponse.json(
        { success: false, error: "File JSON không hợp lệ: " + (parseError.message || "Không thể đọc file") },
        { status: 400 }
      );
    }

    // Step 4: Verify NFT ownership
    const nftQuery = `
      SELECT id, batch_number, object_id, distributor_address, status
      FROM nfts
      WHERE id = $1
      LIMIT 1
    `;
    const nftResult = await pool.query(nftQuery, [Number(nftId)]);

    if (!nftResult.rows.length) {
      return NextResponse.json(
        { success: false, error: "NFT không tìm thấy" },
        { status: 404 }
      );
    }

    const nft = nftResult.rows[0];

    if (nft.distributor_address !== user.address.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "Bạn không sở hữu NFT này" },
        { status: 403 }
      );
    }

    // Step 5: Store sensor data in database
    const now = new Date().toISOString();
    const insertQuery = `
      INSERT INTO sensor_data (
        nft_id,
        temperature,
        humidity,
        gps_lat,
        gps_lng,
        gps_location,
        recorded_at,
        distributor_address,
        raw_data,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const recordedAt = sensorData.timestamp || now;
    const rawData = JSON.stringify(sensorData.additional_data || {});

    const insertResult = await pool.query(insertQuery, [
      Number(nftId),
      sensorData.temperature ?? null,
      sensorData.humidity ?? null,
      sensorData.gps_lat ?? null,
      sensorData.gps_lng ?? null,
      sensorData.gps_location ?? null,
      recordedAt,
      user.address.toLowerCase(),
      rawData,
      now,
    ]);

    const sensorRecord = insertResult.rows[0];

    // Step 6: Update NFT metadata with latest sensor hash
    const updateNftQuery = `
      UPDATE nfts
      SET updated_at = $1,
          metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
      WHERE id = $3
      RETURNING *
    `;

    const metadataUpdate = JSON.stringify({
      last_sensor_update: now,
      sensor_record_id: sensorRecord.id,
      temperature: sensorData.temperature,
      humidity: sensorData.humidity,
      gps_location: sensorData.gps_location,
    });

    await pool.query(updateNftQuery, [now, metadataUpdate, Number(nftId)]);

    logInfo("Sensor data uploaded successfully", {
      requestId,
      nftId: Number(nftId),
      distributor: user.address,
      temperature: sensorData.temperature,
      humidity: sensorData.humidity,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Dữ liệu cảm biến đã được upload thành công",
        data: {
          sensorRecord,
        },
      },
      { status: 200 }
    );

  } catch (error: any) {
    logError("Upload sensor endpoint error", error, { requestId });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Dữ liệu cảm biến không hợp lệ",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Lỗi khi upload dữ liệu cảm biến",
      },
      { status: 500 }
    );
  }
}
