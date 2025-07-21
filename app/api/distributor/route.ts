import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Ví dụ: Bảng nfts (id, name, status, distributor_address)

export async function GET(req: NextRequest) {
  if (req.url?.endsWith("/roles")) {
    // Trả về danh sách các ví có role DISTRIBUTOR từ bảng users
    const { rows } = await pool.query("SELECT address FROM users WHERE role = 'DISTRIBUTOR'");
    return NextResponse.json(rows);
  }
  // Mặc định trả về các NFT đang vận chuyển
  const { rows } = await pool.query('SELECT * FROM nfts WHERE status = $1', ['in_transit']);
  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const { id, status, distributor_address } = await req.json();
  if (!id || !status || !distributor_address) return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });
  const result = await pool.query(
    `UPDATE nfts SET status = $1, distributor_address = $2 WHERE id = $3 RETURNING *`,
    [status, distributor_address, id]
  );
  return NextResponse.json(result.rows[0]);
}

export async function POST(req: NextRequest) {
  // Xử lý upload sensor data
  if (req.url?.endsWith("/upload-sensor")) {
    try {
      const formData = await req.formData();
      const sensorFile = formData.get("sensorData");
      const nftId = formData.get("nftId");
      const distributorAddress = formData.get("distributorAddress");
      if (!sensorFile || !nftId || !distributorAddress) {
        return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 });
      }
      // Upload file lên IPFS (Pinata)
      if (!process.env.PINATA_JWT) {
        return NextResponse.json({ error: "PINATA_JWT chưa được cấu hình" }, { status: 500 });
      }
      const fileForm = new FormData();
      fileForm.append("file", sensorFile);
      const ipfsRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
        body: fileForm,
      });
      if (!ipfsRes.ok) {
        const errText = await ipfsRes.text();
        return NextResponse.json({ error: "Lỗi khi upload file lên IPFS", detail: errText }, { status: 500 });
      }
      const ipfsData = await ipfsRes.json();
      const sensorIpfsHash = ipfsData.IpfsHash;
      // TODO: Cập nhật metadata NFT trên contract nếu cần (yêu cầu quyền distributor hoặc owner)
      // Có thể lưu hash này vào DB nếu muốn
      return NextResponse.json({ success: true, sensorIpfsHash });
    } catch (err: any) {
      return NextResponse.json({ error: "Lỗi khi upload sensor data", detail: err.message }, { status: 500 });
    }
  }
} 