import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import formidable from 'formidable';
import { pinFileToIPFS } from '@/lib/pinata';
import { Readable } from 'stream';

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextRequest) {
  try {
    // Lấy buffer từ NextRequest
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Tạo stream từ buffer
    const stream = Readable.from(buffer);

    // Parse form-data từ stream
    const form = formidable();
    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(stream, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    // Upload file lên IPFS
    const ipfsResult = await pinFileToIPFS(fields, files);

    // Lưu thông tin vào DB (ví dụ)
    const now = new Date().toISOString();
    const { drugName, status, manufacturer_address } = fields;
    const result = await pool.query(
      `INSERT INTO nfts (name, status, created_at, manufacturer_address, ipfs_hash)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [drugName, status, manufacturer_address, now, ipfsResult.IpfsHash]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Lỗi server' }, { status: 500 });
  }
}