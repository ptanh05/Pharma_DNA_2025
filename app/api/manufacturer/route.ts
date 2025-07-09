import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Ví dụ: Bảng nfts (id, name, status, created_at, manufacturer_address)

export async function GET() {
  const { rows } = await pool.query('SELECT * FROM nfts');
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { name, status, manufacturer_address } = await req.json();
  if (!name || !status || !manufacturer_address) return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });
  const now = new Date().toISOString();
  const result = await pool.query(
    `INSERT INTO nfts (name, status, created_at, manufacturer_address)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, status, now, manufacturer_address]
  );
  return NextResponse.json(result.rows[0]);
}

export async function PUT(req: NextRequest) {
  const { id, status } = await req.json();
  if (!id || !status) return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });
  const result = await pool.query(
    `UPDATE nfts SET status = $1 WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return NextResponse.json(result.rows[0]);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });
  await pool.query('DELETE FROM nfts WHERE id = $1', [id]);
  return NextResponse.json({ success: true });
} 