import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { z } from "zod";
import { ensureTableExists, TABLE_DEFINITIONS } from "@/lib/db/table-init";

// Simple validation schema
const uploadMetadataSchema = z.object({
  drugName: z.string().min(1, "Tên thuốc không được để trống").max(100),
  batchNumber: z.string().min(1, "Số lô không được để trống").max(50),
  manufacturingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày sản xuất không hợp lệ"),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Hạn dùng không hợp lệ"),
  description: z.string().optional(),
  manufacturerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$|^0x[a-fA-F0-9]{64}$/, "Địa chỉ không hợp lệ"),
  imageIpfsHash: z.string().optional(),
  certIpfsHash: z.string().optional(),
}).refine(
  (data) => new Date(data.manufacturingDate) <= new Date(data.expiryDate),
  { message: "Hạn dùng phải lớn hơn ngày sản xuất", path: ["expiryDate"] }
);

function sanitizeString(str: string): string {
  return str.replace(/[<>\"']/g, "").trim();
}

export async function POST(request: NextRequest) {
  console.log('[upload-ipfs] Request received');

  let body;
  try {
    const text = await request.text();
    console.log('[upload-ipfs] Raw body:', text);
    body = JSON.parse(text);
  } catch (err) {
    console.error('[upload-ipfs] JSON parse error:', err);
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  // Validate body first
  const validation = uploadMetadataSchema.safeParse(body);
  if (!validation.success) {
    const errors = validation.error.errors.map(e => `${e.path.join(".")}: ${e.message}`);
    console.log('[upload-ipfs] Validation failed:', errors);
    return NextResponse.json({ error: errors.join(", ") }, { status: 400 });
  }

  console.log('[upload-ipfs] Validation passed');

  const { drugName, batchNumber, manufacturingDate, expiryDate, description, manufacturerAddress, imageIpfsHash, certIpfsHash } = validation.data;

  console.log('[upload-ipfs] Manufacturer address:', manufacturerAddress);

  try {
    // Ensure users table exists before querying
    await ensureTableExists("users", TABLE_DEFINITIONS.users);

    // Verify manufacturer has MANUFACTURER role in database
    const roleCheck = await pool.query(
      "SELECT role FROM users WHERE address = $1",
      [manufacturerAddress.toLowerCase()]
    );
    console.log('[upload-ipfs] Role check result:', roleCheck.rows);
    if (roleCheck.rows.length === 0) {
      return NextResponse.json(
        { error: "Địa chỉ này chưa được đăng ký trong hệ thống. Vui lòng liên hệ admin để đăng ký tài khoản." },
        { status: 403 }
      );
    }
    if (roleCheck.rows[0].role !== "MANUFACTURER") {
      return NextResponse.json(
        { error: "Địa chỉ này không có quyền Manufacturer. Role hiện tại: " + roleCheck.rows[0].role },
        { status: 403 }
      );
    }

    // Sanitize
    const sanitized = {
      drugName: sanitizeString(drugName),
      batchNumber: sanitizeString(batchNumber),
      manufacturingDate,
      expiryDate,
      description: description ? sanitizeString(description) : null,
      manufacturerAddress: manufacturerAddress.toLowerCase(),
    };

    // Validate date range
    const mfgDate = new Date(manufacturingDate);
    const expDate = new Date(expiryDate);
    if (mfgDate > expDate) {
      return NextResponse.json({ error: "Hạn dùng phải lớn hơn ngày sản xuất" }, { status: 400 });
    }

    // Create metadata
    const metadata = {
      drugName: sanitized.drugName,
      batchNumber: sanitized.batchNumber,
      manufacturingDate: sanitized.manufacturingDate,
      expiryDate: sanitized.expiryDate,
      description: sanitized.description,
      manufacturerAddress: sanitized.manufacturerAddress,
      timestamp: new Date().toISOString(),
      files: [
        imageIpfsHash ? `ipfs/${imageIpfsHash}` : null,
        certIpfsHash ? `ipfs/${certIpfsHash}` : null,
      ].filter(Boolean),
      version: "1.0",
    };

    // Upload metadata to IPFS
    if (!process.env.PINATA_JWT) {
      return NextResponse.json({ error: "PINATA_JWT chưa được cấu hình" }, { status: 500 });
    }

    const metadataResponse = await fetch(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
        },
        body: JSON.stringify({
          pinataContent: metadata,
          pinataMetadata: {
            name: `${sanitized.drugName}-${sanitized.batchNumber}-metadata`,
            keyvalues: {
              drugName: sanitized.drugName,
              batchNumber: sanitized.batchNumber,
              type: "drug-metadata",
            },
          },
        }),
      }
    );

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      console.error("Lỗi Pinata:", errorText);
      return NextResponse.json({ error: "Lỗi khi upload metadata lên IPFS" }, { status: 500 });
    }

    const metadataResult = await metadataResponse.json();
    console.log("[upload-ipfs] Pinata response:", JSON.stringify(metadataResult));

    // Support both IpfsHash and ipfsHash response formats
    const ipfsHash = metadataResult.IpfsHash || metadataResult.ipfsHash;
    if (!ipfsHash) {
      console.error("[upload-ipfs] No IPFS hash in response:", metadataResult);
      return NextResponse.json({ error: "Không nhận được IPFS hash từ Pinata" }, { status: 500 });
    }

    // Save to database
    await ensureTableExists("nfts", TABLE_DEFINITIONS.nfts);

    const image_url = imageIpfsHash ? `https://gateway.pinata.cloud/ipfs/${imageIpfsHash}` : null;
    const certificate_url = certIpfsHash ? `https://gateway.pinata.cloud/ipfs/${certIpfsHash}` : null;

    // Upsert: insert or update if batch_number already exists
    const dbResult = await pool.query(
      `INSERT INTO nfts (name, batch_number, manufacture_date, expiry_date, description, image_url, certificate_url, status, ipfs_hash, manufacturer_address, distributor_address, pharmacy_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (batch_number) DO UPDATE SET
         name = EXCLUDED.name,
         manufacture_date = EXCLUDED.manufacture_date,
         expiry_date = EXCLUDED.expiry_date,
         description = EXCLUDED.description,
         image_url = EXCLUDED.image_url,
         certificate_url = EXCLUDED.certificate_url,
         status = EXCLUDED.status,
         ipfs_hash = EXCLUDED.ipfs_hash,
         updated_at = NOW()
       RETURNING *`,
      [
        `${sanitized.drugName} - ${sanitized.batchNumber}`,
        sanitized.batchNumber,
        sanitized.manufacturingDate,
        sanitized.expiryDate,
        sanitized.description,
        image_url,
        certificate_url,
        "minted",
        ipfsHash,
        sanitized.manufacturerAddress,
        null,
        null,
      ]
    );

    return NextResponse.json({
      success: true,
      IpfsHash: ipfsHash,
      metadata: metadata,
      databaseId: dbResult.rows[0].id,
      message: dbResult.rows[0].created_at !== dbResult.rows[0].updated_at ? "Cập nhật thành công" : "Upload thành công",
    });
  } catch (error: any) {
    console.error("[upload-ipfs] Error:", {
      name: error.name,
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack,
    });

    // Distinguish error types for better debugging
    if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT" || error.code === "ENOTFOUND") {
      return NextResponse.json(
        { error: "Không thể kết nối database. Vui lòng kiểm tra DATABASE_URL." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: `Lỗi server: ${error.message}` },
      { status: 500 }
    );
  }
}
