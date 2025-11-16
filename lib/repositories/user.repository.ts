/**
 * User Repository
 * Data access layer for user/role operations
 */

import { pool } from '@/lib/db';

export interface CreateUserData {
  address: string;
  role: string;
}

export interface User {
  address: string;
  role: string;
  assigned_at: string;
}

export class UserRepository {
  /**
   * Create or update user role
   */
  async upsert(data: CreateUserData): Promise<User> {
    const now = new Date().toISOString();
    const result = await pool.query(
      `INSERT INTO users (address, role, assigned_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (address) DO UPDATE SET role = $2, assigned_at = $3
       RETURNING *`,
      [data.address.toLowerCase(), data.role, now]
    );
    return result.rows[0];
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

