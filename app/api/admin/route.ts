import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  const { rows } = await pool.query('SELECT address, role, assigned_at FROM users');
  const users = rows.map(u => ({
    ...u,
    assignedAt: u.assigned_at,
  }));
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const { address, role } = await req.json();
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
  const { address } = await req.json();
  if (!address) return NextResponse.json({ error: 'Thiếu địa chỉ' }, { status: 400 });
  await pool.query('DELETE FROM users WHERE address = $1', [address]);
  return NextResponse.json({ success: true });
} 