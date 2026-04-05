/**
 * Role Service
 * Business logic layer for role management
 */

import { UserRepository } from '@/lib/repositories/user.repository';
import { assignRole, getRole } from '@/lib/blockchain/contract';
import { parseSuiError, getSuiErrorHints } from '@/lib/blockchain/errors-sui';
import { getSuiExplorerTxUrl as getExplorerTxUrl } from '@/lib/blockchain/config-sui';
import { Role } from '@/lib/blockchain/types-sui';

export interface AssignRoleData {
  address: string;
  role: 'MANUFACTURER' | 'DISTRIBUTOR' | 'PHARMACY' | 'ADMIN';
  // Optional company info (copied from role_registrations)
  company_name?: string;
  license_number?: string;
  license_ipfs_hash?: string;
  tax_id?: string;
  contact_email?: string;
  contact_phone?: string;
  company_address?: string;
  notes?: string;
}

export interface AssignRoleResult {
  success: boolean;
  message?: string;
  transactionHash?: string;
  explorerUrl?: string;
  error?: string;
  hints?: string[];
}

export class RoleService {
  constructor(private userRepo: UserRepository) {}

  /**
   * Assign role to user (database + blockchain)
   */
  async assignRole(data: AssignRoleData): Promise<AssignRoleResult> {
    try {
      // Check private key
      const privateKey = process.env.OWNER_PRIVATE_KEY;
      if (!privateKey) {
        return {
          success: false,
          error: 'OWNER_PRIVATE_KEY không được cấu hình',
        };
      }

      // Map role string to Role enum
      const roleMap: Record<string, Role> = {
        MANUFACTURER: Role.MANUFACTURER,
        DISTRIBUTOR: Role.DISTRIBUTOR,
        PHARMACY: Role.PHARMACY,
        ADMIN: Role.ADMIN,
      };

      const roleEnum = roleMap[data.role];
      if (!roleEnum) {
        return {
          success: false,
          error: `Role không hợp lệ: ${data.role}`,
        };
      }

      // Save to database first (including company info)
      await this.userRepo.upsert({
        address: data.address,
        role: data.role,
        company_name: data.company_name,
        license_number: data.license_number,
        license_ipfs_hash: data.license_ipfs_hash,
        tax_id: data.tax_id,
        contact_email: data.contact_email,
        contact_phone: data.contact_phone,
        company_address: data.company_address,
        notes: data.notes,
      });

      // Assign role on blockchain
      const txResult = await assignRole(data.address, roleEnum, privateKey);

      if (!txResult.success) {
        return {
          success: false,
          error: txResult.error || 'Lỗi khi gán role trên blockchain',
          hints: getSuiErrorHints(txResult.error),
        };
      }

      return {
        success: true,
        message: `✅ Đã cấp quyền ${data.role} cho địa chỉ ${data.address} và đồng bộ lên blockchain thành công!`,
        transactionHash: txResult.digest,
        explorerUrl: getExplorerTxUrl(txResult.digest),
      };
    } catch (error: any) {
      const suiError = parseSuiError(error);
      return {
        success: false,
        error: suiError,
        hints: getSuiErrorHints(suiError),
      };
    }
  }

  /**
   * Get user role (from database, fallback to blockchain)
   */
  async getUserRole(address: string): Promise<{ role: string | null; source: 'database' | 'blockchain' }> {
    try {
      // Try database first
      const user = await this.userRepo.findByAddress(address);
      if (user) {
        return { role: user.role, source: 'database' };
      }

      // Fallback to blockchain
      const blockchainRole = await getRole(address);
      if (blockchainRole !== Role.NONE) {
        // Map Role enum to string
        const roleMap: Record<Role, string> = {
          [Role.NONE]: 'NONE',
          [Role.MANUFACTURER]: 'MANUFACTURER',
          [Role.DISTRIBUTOR]: 'DISTRIBUTOR',
          [Role.PHARMACY]: 'PHARMACY',
          [Role.ADMIN]: 'ADMIN',
        };

        const roleString = roleMap[blockchainRole];
        
        // Sync to database
        if (roleString !== 'NONE') {
          await this.userRepo.upsert({
            address,
            role: roleString,
          });
        }

        return { role: roleString, source: 'blockchain' };
      }

      return { role: null, source: 'database' };
    } catch (error) {
      console.error('Error getting user role:', error);
      return { role: null, source: 'database' };
    }
  }

  /**
   * Check if user has specific role
   */
  async hasRole(address: string, role: string): Promise<boolean> {
    const userRole = await this.getUserRole(address);
    return userRole.role === role;
  }

  /**
   * Remove user role
   */
  async removeUser(address: string): Promise<boolean> {
    try {
      return await this.userRepo.delete(address);
    } catch (error) {
      console.error('Error removing user:', error);
      return false;
    }
  }

  /**
   * Get all users with role
   */
  async getUsersByRole(role: string): Promise<any[]> {
    try {
      return await this.userRepo.findByRole(role);
    } catch (error) {
      console.error('Error getting users by role:', error);
      return [];
    }
  }
}

