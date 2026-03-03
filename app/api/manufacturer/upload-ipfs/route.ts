import { type NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { z } from "zod";

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
  try {
    const text = await request.text();
    let body;

    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Dữ liệu không hợp lệ" },
        { status: 400 }
      );
    }

    // Validate
    const validation = uploadMetadataSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join(".")}: ${e.message}`);
      return NextResponse.json(
        { error: errors.join(", ") },
        { status: 400 }
      );
    }

    const { drugName, batchNumber, manufacturingDate, expiryDate, description, manufacturerAddress, imageIpfsHash, certIpfsHash } = validation.data;

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
      return NextResponse.json(
        { error: "Hạn dùng phải lớn hơn ngày sản xuất" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "PINATA_JWT chưa được cấu hình" },
        { status: 500 }
      );
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
      return NextResponse.json(
        { error: "Lỗi khi upload metadata lên IPFS" },
        { status: 500 }
      );
    }

    const metadataResult = await metadataResponse.json();
    const ipfsHash = metadataResult.IpfsHash;

    // Save to database
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS nfts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        batch_number VARCHAR(100) UNIQUE,
        manufacture_date DATE,
        expiry_date DATE,
        description TEXT,
        image_url TEXT,
        certificate_url TEXT,
        status VARCHAR(50) DEFAULT 'CREATED',
        ipfs_hash VARCHAR(255),
        manufacturer_address VARCHAR(100),
        distributor_address VARCHAR(100),
        pharmacy_address VARCHAR(100),
        token_id VARCHAR(100),
        object_id VARCHAR(66),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`);

      await pool.query(`CREATE INDEX IF NOT EXISTS idx_nfts_batch_number ON nfts(batch_number)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_nfts_object_id ON nfts(object_id)`);

      const image_url = imageIpfsHash
        ? `https://gateway.pinata.cloud/ipfs/${imageIpfsHash}`
        : null;
      const certificate_url = certIpfsHash
        ? `https://gateway.pinata.cloud/ipfs/${certIpfsHash}`
        : null;

      const dbResult = await pool.query(
        `INSERT INTO nfts (name, batch_number, manufacture_date, expiry_date, description, image_url, certificate_url, status, ipfs_hash, manufacturer_address, distributor_address, pharmacy_address) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [
          `${sanitized.drugName} - ${sanitized.batchNumber}`,
          sanitized.batchNumber,
          sanitized.manufacturingDate,
          sanitized.expiryDate,
          sanitized.description,
          image_url,
          certificate_url,
          "CREATED",
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
        message: "Upload thành công",
      });
    } catch (dbError) {
      console.error("Lỗi database:", dbError);
      return NextResponse.json({
        success: true,
        IpfsHash: ipfsHash,
        metadata: metadata,
        message: "Upload IPFS thành công, lỗi khi lưu database",
      });
    }
  } catch (error) {
    console.error("Lỗi upload:", error);
    return NextResponse.json(
      { error: "Lỗi server" },
      { status: 500 }
    );
  }
}
