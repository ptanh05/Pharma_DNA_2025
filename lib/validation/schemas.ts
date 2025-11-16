/**
 * Validation Schemas
 * Zod schemas for input validation
 */

import { z } from 'zod';

// Neo N3 address format: 34 characters starting with N
const neoAddressRegex = /^N[a-zA-Z0-9]{33}$/;

// IPFS hash format: Qm followed by 44 base58 characters
const ipfsHashRegex = /^Qm[a-zA-Z0-9]{44}$/;

/**
 * Mint NFT Schema
 */
export const MintNFTSchema = z.object({
  ipfsHash: z.string().regex(ipfsHashRegex, 'IPFS hash không hợp lệ'),
  account: z.string().regex(neoAddressRegex, 'Địa chỉ Neo N3 không hợp lệ'),
  batchNumber: z.string().min(1).max(100).optional(),
  expiryDate: z.number().int().positive().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Transfer NFT Schema
 */
export const TransferNFTSchema = z.object({
  tokenId: z.number().int().positive('Token ID phải là số nguyên dương'),
  to: z.string().regex(neoAddressRegex, 'Địa chỉ người nhận không hợp lệ'),
  from: z.string().regex(neoAddressRegex, 'Địa chỉ người gửi không hợp lệ').optional(),
});

/**
 * Create Milestone Schema
 */
export const CreateMilestoneSchema = z.object({
  nftId: z.number().int().positive('NFT ID phải là số nguyên dương'),
  type: z.string().min(1).max(100, 'Loại milestone tối đa 100 ký tự'),
  description: z.string().max(500, 'Mô tả tối đa 500 ký tự').optional(),
  location: z.string().max(200, 'Vị trí tối đa 200 ký tự').optional(),
  actorAddress: z.string().regex(neoAddressRegex, 'Địa chỉ người thực hiện không hợp lệ'),
});

/**
 * Assign Role Schema
 */
export const AssignRoleSchema = z.object({
  address: z.string().regex(neoAddressRegex, 'Địa chỉ không hợp lệ'),
  role: z.enum(['MANUFACTURER', 'DISTRIBUTOR', 'PHARMACY', 'ADMIN'], {
    errorMap: () => ({ message: 'Role không hợp lệ' }),
  }),
});

/**
 * Update NFT Status Schema
 */
export const UpdateNFTStatusSchema = z.object({
  id: z.number().int().positive('ID phải là số nguyên dương'),
  status: z.string().min(1, 'Status không được để trống'),
  address: z.string().regex(neoAddressRegex, 'Địa chỉ không hợp lệ').optional(),
  addressType: z.enum(['distributor', 'pharmacy']).optional(),
});

/**
 * Query NFT Schema
 */
export const QueryNFTSchema = z.object({
  tokenId: z.number().int().positive().optional(),
  owner: z.string().regex(neoAddressRegex).optional(),
  status: z.string().optional(),
  batchNumber: z.string().optional(),
});

/**
 * Upload IPFS Schema
 */
export const UploadIPFSSchema = z.object({
  metadata: z.record(z.any()).optional(),
  file: z.any().optional(), // File object
});

