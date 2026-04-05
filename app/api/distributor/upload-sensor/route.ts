/**
 * API Route: POST /api/distributor/upload-sensor
 * Upload AIoT sensor data (temperature, humidity, GPS, etc.) for an NFT
 *
 * No JWT required — ownership is verified from database record.
 * Body (FormData):
 *   - sensorData: JSON file with sensor readings
 *   - nftId: NFT identifier
 *   - distributorAddress: distributor wallet address (must match DB record)
 */

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { logInfo, logError } from "@/lib/logger";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { ensureTableExists, TABLE_DEFINITIONS } from "@/lib/db/table-init";

const sensorDataSchema = z.object({
  temperature: z.number().optional(),
  humidity: z.number().optional(),
  gps_lat: z.number().optional(),
  gps_lng: z.number().optional(),
  gps_location: z.string().optional(),
  timestamp: z.string().optional(),
  additional_data: z.record(z.any()).optional(),
});

export async function POST(req: NextRequest) {
  const requestId = uuidv4();

  try {
    // Bước 1: Parse form data
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

    if (!distributorAddress || typeof distributorAddress !== "string") {
      return NextResponse.json(
        { success: false, error: "distributorAddress là bắt buộc" },
        { status: 400 }
      );
    }

    // Validate distributor address format
    const addrRegex = /^0x[a-fA-F0-9]{64}$/;
    if (!addrRegex.test(distributorAddress)) {
      return NextResponse.json(
        { success: false, error: "Địa chỉ Sui không hợp lệ" },
        { status: 400 }
      );
    }

    const distAddr = distributorAddress.toLowerCase();

    // Bước 2: Parse sensor data from JSON file
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

    // Bước 3: Ensure tables exist
    await Promise.all([
      ensureTableExists("nfts", TABLE_DEFINITIONS.nfts),
      ensureTableExists("sensor_data", TABLE_DEFINITIONS.sensor_data),
    ]).catch(() => {});

    // Bước 4: Verify NFT ownership from DB
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

    if (nft.distributor_address !== distAddr) {
      return NextResponse.json(
        { success: false, error: "Bạn không sở hữu NFT này" },
        { status: 403 }
      );
    }

    // Bước 5: Store sensor data in database
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
      distAddr,
      rawData,
      now,
    ]);

    const sensorRecord = insertResult.rows[0];

    // Bước 6: Update NFT metadata with latest sensor hash
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
      distributor: distAddr,
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
