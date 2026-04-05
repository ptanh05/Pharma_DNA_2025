/**
 * User Repository
 * Data access layer for user/role operations
 */

import { pool } from '@/lib/db';

export interface CreateUserData {
  address: string;
  role: string;
  // Company info (optional, copied from role_registrations on approval)
  company_name?: string;
  license_number?: string;
  license_ipfs_hash?: string;
  tax_id?: string;
  contact_email?: string;
  contact_phone?: string;
  company_address?: string;
  notes?: string;
}

export interface User {
  address: string;
  role: string;
  assigned_at: string;
  // Company info
  company_name?: string;
  license_number?: string;
  license_ipfs_hash?: string;
  tax_id?: string;
  contact_email?: string;
  contact_phone?: string;
  company_address?: string;
  notes?: string;
}

export class UserRepository {
  /**
   * Create or update user role, optionally including company info
   */
  async upsert(data: CreateUserData): Promise<User> {
    const now = new Date().toISOString();
    const result = await pool.query(
      `INSERT INTO users (address, role, assigned_at, company_name, license_number,
                          license_ipfs_hash, tax_id, contact_email, contact_phone,
                          company_address, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (address) DO UPDATE SET
         role = EXCLUDED.role,
         assigned_at = EXCLUDED.assigned_at,
         company_name = COALESCE(EXCLUDED.company_name, users.company_name),
         license_number = COALESCE(EXCLUDED.license_number, users.license_number),
         license_ipfs_hash = COALESCE(EXCLUDED.license_ipfs_hash, users.license_ipfs_hash),
         tax_id = COALESCE(EXCLUDED.tax_id, users.tax_id),
         contact_email = COALESCE(EXCLUDED.contact_email, users.contact_email),
         contact_phone = COALESCE(EXCLUDED.contact_phone, users.contact_phone),
         company_address = COALESCE(EXCLUDED.company_address, users.company_address),
         notes = COALESCE(EXCLUDED.notes, users.notes)
       RETURNING *`,
      [
        data.address.toLowerCase(),
        data.role,
        now,
        data.company_name ?? null,
        data.license_number ?? null,
        data.license_ipfs_hash ?? null,
        data.tax_id ?? null,
        data.contact_email ?? null,
        data.contact_phone ?? null,
        data.company_address ?? null,
        data.notes ?? null,
      ]
    );
    return result.rows[0];
  }

  /**
   * Update company info for existing user
   */
  async updateCompanyInfo(address: string, info: Partial<CreateUserData>): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields: (keyof CreateUserData)[] = [
      'company_name', 'license_number', 'license_ipfs_hash', 'tax_id',
      'contact_email', 'contact_phone', 'company_address', 'notes',
    ];

    for (const field of allowedFields) {
      if (info[field] !== undefined) {
        fields.push(`${field} = $${paramIndex}`);
        values.push(info[field]);
        paramIndex++;
      }
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = NOW()`);
    values.push(address.toLowerCase());

    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE address = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by address
   */
  async findByAddress(address: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE address = $1',
      [address.toLowerCase()]
    );
    return result.rows[0] || null;
  }

  /**
   * Find users by role
   */
  async findByRole(role: string): Promise<User[]> {
    const result = await pool.query(
      'SELECT * FROM users WHERE role = $1 ORDER BY assigned_at DESC',
      [role]
    );
    return result.rows;
  }

  /**
   * Get all users
   */
  async findAll(): Promise<User[]> {
    const result = await pool.query(
      'SELECT * FROM users ORDER BY assigned_at DESC'
    );
    return result.rows;
  }

  /**
   * Delete user
   */
  async delete(address: string): Promise<boolean> {
    try {
      await pool.query('DELETE FROM users WHERE address = $1', [address.toLowerCase()]);
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  /**
   * Check if user has role
   */
  async hasRole(address: string, role: string): Promise<boolean> {
    const user = await this.findByAddress(address);
    return user?.role === role;
  }
}

