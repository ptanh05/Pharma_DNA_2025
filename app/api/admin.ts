import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextRequest, res: NextResponse) {
  if (req.method === 'GET') {
    // Lấy danh sách user
    const { rows } = await pool.query('SELECT address, role, assigned_at FROM users');
    // Chuyển assigned_at -> assignedAt cho frontend
    const users = rows.map(u => ({
      ...u,
      assignedAt: u.assigned_at,
    }));
    return res.status(200).json(users);
  }

  if (req.method === 'POST') {
    const { address, role } = req.body;
    if (!address || !role) return res.status(400).json({ error: 'Thiếu thông tin' });
    const now = new Date().toISOString();
    // Upsert user
    await pool.query(
      `INSERT INTO users (address, role, assigned_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (address) DO UPDATE SET role = $2, assigned_at = $3`,
      [address, role, now]
    );
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'Thiếu địa chỉ' });
    await pool.query('DELETE FROM users WHERE address = $1', [address]);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}