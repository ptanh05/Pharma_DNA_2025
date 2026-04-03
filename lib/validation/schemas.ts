/**
 * Zod Validation Schemas
 * Centralized validation schemas for API routes and forms
 */

import { z } from "zod";

/**
 * Sui Address Validation
 * Sui addresses are 32 bytes (64 hex chars) prefixed with 0x
 * Also supports Ethereum addresses (40 hex chars) for compatibility
 */
export const suiAddressSchema = z
  .string()
  .regex(
    /^0x[a-fA-F0-9]{40}$|^0x[a-fA-F0-9]{64}$/,
    "Địa chỉ không hợp lệ. Phải là địa chỉ Ethereum (0x + 40 hex) hoặc Sui (0x + 64 hex)"
  )
  .refine(
    (addr) => {
      // Ethereum: 0x + 40 hex = 42 chars
      // Sui: 0x + 64 hex = 66 chars
      return addr.length === 42 || addr.length === 66;
    },
    {
      message: "Địa chỉ phải có 42 ký tự (Ethereum) hoặc 66 ký tự (Sui)",
    }
  );

/**
 * Object ID Validation (Sui object IDs are similar to addresses)
 */
export const objectIdSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Object ID không hợp lệ");

/**
 * IPFS Hash Validation
 * IPFS hashes can be CIDv0 (Qm...) or CIDv1 (base58 encoded)
 */
export const ipfsHashSchema = z
  .string()
  .min(1, "IPFS hash không được để trống")
  .max(200, "IPFS hash quá dài")
  .refine(
    (hash) => {
      // CIDv0 starts with Qm and is 46 chars
      // CIDv1 can be various lengths
      return hash.startsWith("Qm") || hash.length >= 20;
    },
    { message: "IPFS hash không đúng format" }
  );

/**
 * Batch Number Validation
 */
export const batchNumberSchema = z
  .string()
  .min(1, "Số lô không được để trống")
  .max(100, "Số lô quá dài")
  .regex(/^[A-Za-z0-9\-_]+$/, "Số lô chỉ được chứa chữ cái, số, dấu gạch ngang và gạch dưới");

/**
 * Drug Name Validation
 */
export const drugNameSchema = z
  .string()
  .min(1, "Tên thuốc không được để trống")
  .max(200, "Tên thuốc quá dài")
  .refine(
    (name) => {
      // Allow Vietnamese characters, English, numbers, and common symbols
      return /^[a-zA-Z0-9\s\-_.,()àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]+$/.test(name);
    },
    { message: "Tên thuốc chứa ký tự không hợp lệ" }
  );

/**
 * Date Validation (ISO string or timestamp)
 */
export const dateSchema = z
  .union([
    z.string().datetime({ message: "Ngày tháng không đúng format ISO" }),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày tháng phải có format YYYY-MM-DD"),
  ])
  .or(z.number().int().positive("Timestamp phải là số dương"));

/**
 * Expiry Date must be after manufacturing date
 */
export const createDateRangeSchema = (manufacturingDate: Date | number) => {
  const manufacturing = typeof manufacturingDate === "number" 
    ? manufacturingDate 
    : manufacturingDate.getTime();
  
  return z
    .number()
    .int()
    .positive()
    .refine(
      (expiry) => expiry > manufacturing,
      {
        message: "Hạn dùng phải sau ngày sản xuất",
      }
    );
};

/**
 * Description Validation
 */
export const descriptionSchema = z
  .string()
  .max(2000, "Mô tả quá dài (tối đa 2000 ký tự)")
  .optional()
  .nullable();

/**
 * Transfer Note Validation
 */
export const transferNoteSchema = z
  .string()
  .max(500, "Ghi chú quá dài (tối đa 500 ký tự)")
  .optional()
  .nullable();

/**
 * NFT ID Validation (can be number from DB or objectId string)
 */
export const nftIdSchema = z.union([
  z.number().int().positive("NFT ID phải là số dương"),
  objectIdSchema,
  z.string().transform((val) => {
    // Try to parse as number
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) return num;
    // Otherwise treat as objectId
    return val;
  }),
]);

/**
 * Status Validation
 */
export const transferStatusSchema = z.enum(["pending", "approved", "rejected", "cancelled"], {
  errorMap: () => ({ message: "Trạng thái không hợp lệ" }),
});

/**
 * Role Validation
 */
export const roleSchema = z.enum(["ADMIN", "MANUFACTURER", "DISTRIBUTOR", "PHARMACY"], {
  errorMap: () => ({ message: "Vai trò không hợp lệ" }),
});

/**
 * Requested Role Validation (exclude ADMIN from public registration)
 */
export const requestedRoleSchema = z.enum(["MANUFACTURER", "DISTRIBUTOR", "PHARMACY"], {
  errorMap: () => ({ message: "Vai trò đăng ký không hợp lệ" }),
});

/**
 * Role Registration Schemas
 */

// Manufacturer registration
export const manufacturerRegistrationSchema = z.object({
  companyName: z.string().min(1, "Tên công ty không được trống").max(200),
  licenseNumber: z.string().min(1, "Số giấy phép không được trống").max(100),
  taxId: z.string().max(50).optional(),
  licenseIpfsHash: ipfsHashSchema,
});

// Distributor registration
export const distributorRegistrationSchema = z.object({
  distributorName: z.string().min(1, "Tên công ty không được trống").max(200),
  licenseNumber: z.string().min(1, "Số giấy phép không được trống").max(100),
  licenseIpfsHash: ipfsHashSchema,
  distributorAddress: z.string().min(1, "Địa chỉ không được trống").max(300),
});

// Pharmacy registration
export const pharmacyRegistrationSchema = z.object({
  pharmacyName: z.string().min(1, "Tên nhà thuốc không được trống").max(200),
  licenseNumber: z.string().min(1, "Số giấy phép không được trống").max(100),
  licenseIpfsHash: ipfsHashSchema,
  pharmacyAddress: z.string().min(1, "Địa chỉ không được trống").max(300),
});

// Union schema for role-specific fields
export const roleSpecificFieldsSchema = z.union([
  manufacturerRegistrationSchema,
  distributorRegistrationSchema,
  pharmacyRegistrationSchema,
]);

// Full registration schema
export const submitRegistrationSchema = z.object({
  walletAddress: suiAddressSchema,
  requestedRole: requestedRoleSchema,
  contactEmail: z.string().email("Email không hợp lệ").or(z.literal("")).optional(),
  contactPhone: z.string().max(20).optional(),
  notes: z.string().max(500).optional(),
}).and(roleSpecificFieldsSchema);

// Review schema
export const reviewRegistrationSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  rejectionReason: z.string().max(500).optional(),
});

// List registrations query schema
export const listRegistrationsSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

/**
 * File Upload Validation
 */
export const fileUploadSchema = z.object({
  type: z.string().refine(
    (type) => {
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "application/pdf",
        "application/json",
      ];
      return allowedTypes.includes(type);
    },
    { message: "Loại file không được phép" }
  ),
  size: z.number().max(10 * 1024 * 1024, "File không được vượt quá 10MB"), // 10MB max
});

/**
 * Mint NFT Request Schema
 */
export const mintNFTRequestSchema = z.object({
  ipfsHash: ipfsHashSchema,
  account: suiAddressSchema,
  batchNumber: batchNumberSchema.optional(),
  expiryDate: z.number().int().positive().optional(),
});

/**
 * Save NFT Request Schema
 */
export const saveNFTRequestSchema = z.object({
  objectId: objectIdSchema,
  ipfsHash: ipfsHashSchema,
  account: suiAddressSchema,
  batchNumber: batchNumberSchema,
  transactionDigest: z.string().min(1, "Transaction digest không được để trống"),
});

/**
 * Transfer NFT Request Schema
 */
export const transferNFTRequestSchema = z.object({
  objectId: objectIdSchema,
  to: suiAddressSchema,
});

/**
 * Create Transfer Request Schema
 */
export const createTransferRequestSchema = z.object({
  nft_id: nftIdSchema,
  pharmacy_address: suiAddressSchema,
  transfer_note: transferNoteSchema,
});

/**
 * Update Transfer Request Schema
 */
export const updateTransferRequestSchema = z.object({
  request_id: z.number().int().positive("Request ID phải là số dương"),
  status: transferStatusSchema,
  pharmacy_address: suiAddressSchema,
});

/**
 * Assign Role Schema
 */
export const assignRoleSchema = z.object({
  address: suiAddressSchema,
  role: roleSchema,
});

/**
 * Upload IPFS Metadata Schema
 */
export const uploadIPFSMetadataSchema = z.object({
  drugName: drugNameSchema,
  batchNumber: batchNumberSchema,
  manufacturingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày sản xuất phải có format YYYY-MM-DD"),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Hạn dùng phải có format YYYY-MM-DD"),
  description: descriptionSchema,
  manufacturerAddress: suiAddressSchema,
}).refine(
  (data) => {
    const manufacturing = new Date(data.manufacturingDate);
    const expiry = new Date(data.expiryDate);
    return expiry > manufacturing;
  },
  {
    message: "Hạn dùng phải sau ngày sản xuất",
    path: ["expiryDate"],
  }
);

/**
 * Milestone Schema
 */
export const milestoneSchema = z.object({
  nft_id: nftIdSchema.optional(),
  batch_number: z.string().optional(),
  type: z.string().min(1, "Loại mốc không được để trống").max(100),
  description: descriptionSchema,
  location: z.string().max(200).optional().nullable(),
  actor_address: suiAddressSchema,
  timestamp: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)),
});

/**
 * Sanitize string input (remove HTML tags, escape special chars)
 */
export function sanitizeString(input: string): string {
  if (typeof input !== "string") return "";
  
  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, "");
  
  // Escape special characters for SQL injection prevention
  // Note: Using parameterized queries is still the best practice
  sanitized = sanitized
    .replace(/'/g, "''") // Escape single quotes
    .replace(/;/g, "") // Remove semicolons
    .replace(/--/g, "") // Remove SQL comments
    .replace(/\/\*/g, "") // Remove SQL block comments start
    .replace(/\*\//g, ""); // Remove SQL block comments end
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Sanitize address (lowercase and validate)
 */
export function sanitizeAddress(address: string): string {
  if (typeof address !== "string") return "";
  return address.toLowerCase().trim();
}

/**
 * Validate and sanitize Sui address
 */
export function validateAndSanitizeAddress(address: string): { valid: boolean; sanitized?: string; error?: string } {
  try {
    const sanitized = sanitizeAddress(address);
    suiAddressSchema.parse(sanitized);
    return { valid: true, sanitized };
  } catch (error: any) {
    return { 
      valid: false, 
      error: error.errors?.[0]?.message || "Địa chỉ không hợp lệ" 
    };
  }
}
