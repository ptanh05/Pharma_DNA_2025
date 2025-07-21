// Nếu bạn gặp lỗi 'Cannot find module ...', hãy chắc chắn đã cài các package sau:
// npm install pg
// npm install next

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  const { rows } = await pool.query('SELECT address, role, assigned_at FROM users');
  const users = rows.map((u: { address: string; role: string; assigned_at: string }) => ({
    ...u,
    address: u.address.toLowerCase(),
    assignedAt: u.assigned_at,
  }));
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const address = body.address?.toLowerCase();
  const role = body.role;
  if (!address || !role) return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO users (address, role, assigned_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (address) DO UPDATE SET role = $2, assigned_at = $3`,
    [address, role, now]
  );
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const address = body.address?.toLowerCase();
  if (!address) return NextResponse.json({ error: 'Thiếu địa chỉ' }, { status: 400 });
  await pool.query('DELETE FROM users WHERE address = $1', [address]);
  return NextResponse.json({ success: true });
} 