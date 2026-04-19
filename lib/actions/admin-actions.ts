/**
 * Server-side functions for Admin data fetching
 * Can be used in Server Components for optimal performance
 */

import { UserRepository, User } from "@/lib/repositories/user.repository";
import { logger } from '@/lib/utils/logger';

const userRepo = new UserRepository();

export interface AdminStats {
  totalUsers: number;
  manufacturers: number;
  distributors: number;
  pharmacies: number;
  admins: number;
}

export interface UserWithFormatted extends User {
  formattedAddress: string;
  assignedAt: string;
}

/**
 * Fetch all users with formatting - runs on server
 */
export async function getUsers(): Promise<UserWithFormatted[]> {
  try {
    const users = await userRepo.findAll();
    return users.map((user) => ({
      ...user,
      formattedAddress: formatAddress(user.address),
      assignedAt: formatDate(user.assigned_at),
    }));
  } catch (error) {
    logger.error('ADMIN_ACTIONS', 'Error fetching users', error);
    return [];
  }
}

/**
 * Fetch admin statistics - runs on server
 */
export async function getAdminStats(): Promise<AdminStats> {
  try {
    const users = await userRepo.findAll();
    return {
      totalUsers: users.length,
      manufacturers: users.filter((u) => u.role === "MANUFACTURER").length,
      distributors: users.filter((u) => u.role === "DISTRIBUTOR").length,
      pharmacies: users.filter((u) => u.role === "PHARMACY").length,
      admins: users.filter((u) => u.role === "ADMIN").length,
    };
  } catch (error) {
    logger.error('ADMIN_ACTIONS', 'Error fetching admin stats', error);
    return {
      totalUsers: 0,
      manufacturers: 0,
      distributors: 0,
      pharmacies: 0,
      admins: 0,
    };
  }
}

/**
 * Format address for display (0x1234...5678)
 */
function formatAddress(address: string): string {
  if (!address) return "";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
