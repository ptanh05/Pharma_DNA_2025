import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Ví dụ: Bảng nfts (id, name, status, distributor_address)

export async function GET() {
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