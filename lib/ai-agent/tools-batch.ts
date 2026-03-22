/**
 * Batch Operations Tools for AI Agent
 * Các tools để xử lý hàng loạt operations
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { pool } from "@/lib/db";
import { mintProductNFT, transferProductNFT, getRole, Role } from "@/lib/blockchain/contract";
import { validateTokenId, validateAddress, validateIPFSHash, validateBatchNumber, validateExpiryDate } from "./validator";

/**
 * Tool: Batch Mint NFTs
 * Mint nhiều NFT cùng lúc từ file Excel hoặc array
 */
export const batchMintNFTsTool = new DynamicStructuredTool({
  name: "batch_mint_nfts",
  description: "Mint nhiều NFT cùng lúc từ danh sách sản phẩm",
  schema: z.object({
    products: z.array(z.object({
      name: z.string(),
      ipfsHash: z.string(),
      batchNumber: z.string(),
      expiryDate: z.number(),
    })),
    manufacturerAddress: z.string().describe("Địa chỉ nhà sản xuất"),
  }),
  func: async ({ products, manufacturerAddress }) => {
    try {
      // Validate inputs
      const addressValidation = validateAddress(manufacturerAddress);
      if (!addressValidation.valid) {
        return JSON.stringify({ success: false, error: addressValidation.error });
      }

      // Check manufacturer role
      const role = await getRole(manufacturerAddress);
      if (role !== Role.MANUFACTURER) {
        return JSON.stringify({ success: false, error: "Address does not have MANUFACTURER role" });
      }

      // Validate all products
      const validationErrors: string[] = [];
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        
        const ipfsValidation = validateIPFSHash(product.ipfsHash);
        if (!ipfsValidation.valid) {
          validationErrors.push(`Product ${i + 1}: ${ipfsValidation.error}`);
        }

        const batchValidation = validateBatchNumber(product.batchNumber);
        if (!batchValidation.valid) {
          validationErrors.push(`Product ${i + 1}: ${batchValidation.error}`);
        }

        const expiryValidation = validateExpiryDate(product.expiryDate);
        if (!expiryValidation.valid) {
          validationErrors.push(`Product ${i + 1}: ${expiryValidation.error}`);
        }
      }

      if (validationErrors.length > 0) {
        return JSON.stringify({ 
          success: false, 
          error: "Validation errors", 
          details: validationErrors 
        });
      }

      if (!process.env.OWNER_PRIVATE_KEY) {
        return JSON.stringify({ success: false, error: "OWNER_PRIVATE_KEY not configured" });
      }

      // Mint NFTs
      const results: any[] = [];
      const errors: any[] = [];

      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        try {
          const txResult = await mintProductNFT(
            product.ipfsHash,
            product.batchNumber,
            product.expiryDate,
            process.env.OWNER_PRIVATE_KEY
          );

          if (txResult.success) {
            const tokenId = (txResult as any).objectId || (txResult as any).tokenId || (txResult as any).digest;
            // Save to database
            await pool.query(
              `INSERT INTO nfts (name, status, manufacturer_address, ipfs_hash, batch_number, object_id, transaction_hash, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
              [
                product.name,
                "minted",
                manufacturerAddress,
                product.ipfsHash,
                product.batchNumber,
                tokenId || null,
                txResult.digest || null,
              ]
            );

            results.push({
              index: i + 1,
              name: product.name,
              objectId: tokenId,
              txDigest: txResult.digest,
              success: true,
            });
          } else {
            errors.push({
              index: i + 1,
              name: product.name,
              error: txResult.error || "Minting failed",
            });
          }
        } catch (error: any) {
          errors.push({
            index: i + 1,
            name: product.name,
            error: error.message || "Unknown error",
          });
        }

        // Small delay to avoid rate limiting
        if (i < products.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      return JSON.stringify({
        success: true,
        summary: {
          total: products.length,
          successful: results.length,
          failed: errors.length,
        },
        results,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error("Batch mint error:", error);
      return JSON.stringify({ 
        success: false, 
        error: error.message || "Unknown error occurred",
      });
    }
  },
});

/**
 * Tool: Batch Transfer NFTs
 * Transfer nhiều NFT cùng lúc
 */
export const batchTransferNFTsTool = new DynamicStructuredTool({
  name: "batch_transfer_nfts",
  description: "Transfer nhiều NFT cùng lúc từ một address sang address khác",
  schema: z.object({
    transfers: z.array(z.object({
      tokenId: z.number(),
      fromAddress: z.string(),
      toAddress: z.string(),
    })),
  }),
  func: async ({ transfers }) => {
    try {
      // Validate all transfers
      const validationErrors: string[] = [];
      for (let i = 0; i < transfers.length; i++) {
        const transfer = transfers[i];
        
        const tokenValidation = validateTokenId(transfer.tokenId);
        if (!tokenValidation.valid) {
          validationErrors.push(`Transfer ${i + 1}: ${tokenValidation.error}`);
        }

        const fromValidation = validateAddress(transfer.fromAddress);
        if (!fromValidation.valid) {
          validationErrors.push(`Transfer ${i + 1}: Invalid from address`);
        }

        const toValidation = validateAddress(transfer.toAddress);
        if (!toValidation.valid) {
          validationErrors.push(`Transfer ${i + 1}: Invalid to address`);
        }
      }

      if (validationErrors.length > 0) {
        return JSON.stringify({ 
          success: false, 
          error: "Validation errors", 
          details: validationErrors 
        });
      }

      if (!process.env.OWNER_PRIVATE_KEY) {
        return JSON.stringify({ success: false, error: "OWNER_PRIVATE_KEY not configured" });
      }

      // Execute transfers
      const results: any[] = [];
      const errors: any[] = [];

      for (let i = 0; i < transfers.length; i++) {
        const transfer = transfers[i];
        try {
          // For Sui, tokenId should be the objectId string
          const objectId = typeof transfer.tokenId === 'string'
            ? transfer.tokenId
            : String(transfer.tokenId);
          const txResult = await transferProductNFT(
            objectId,
            transfer.toAddress,
            process.env.OWNER_PRIVATE_KEY!
          );

          if (txResult.success) {
            // Update database - try object_id first, then id
            await pool.query(
              `UPDATE nfts SET distributor_address = $1, status = 'in_transit' WHERE object_id = $2 OR id = $2`,
              [transfer.toAddress, objectId]
            );

            results.push({
              index: i + 1,
              tokenId: objectId,
              txDigest: txResult.digest,
              success: true,
            });
          } else {
            errors.push({
              index: i + 1,
              tokenId: transfer.tokenId,
              error: txResult.error || "Transfer failed",
            });
          }
        } catch (error: any) {
          errors.push({
            index: i + 1,
            tokenId: transfer.tokenId,
            error: error.message || "Unknown error",
          });
        }

        // Small delay to avoid rate limiting
        if (i < transfers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      return JSON.stringify({
        success: true,
        summary: {
          total: transfers.length,
          successful: results.length,
          failed: errors.length,
        },
        results,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error("Batch transfer error:", error);
      return JSON.stringify({ 
        success: false, 
        error: error.message || "Unknown error occurred",
      });
    }
  },
});

/**
 * Tool: Batch Create Milestones
 * Tạo milestones cho nhiều NFT cùng lúc
 */
export const batchCreateMilestonesTool = new DynamicStructuredTool({
  name: "batch_create_milestones",
  description: "Tạo milestones cho nhiều NFT cùng lúc",
  schema: z.object({
    milestones: z.array(z.object({
      nftId: z.number(),
      type: z.string(),
      description: z.string().optional(),
      location: z.string().optional(),
      actorAddress: z.string(),
    })),
  }),
  func: async ({ milestones }) => {
    try {
      // Validate all milestones
      const validationErrors: string[] = [];
      for (let i = 0; i < milestones.length; i++) {
        const milestone = milestones[i];
        
        const tokenValidation = validateTokenId(milestone.nftId);
        if (!tokenValidation.valid) {
          validationErrors.push(`Milestone ${i + 1}: ${tokenValidation.error}`);
        }

        const addressValidation = validateAddress(milestone.actorAddress);
        if (!addressValidation.valid) {
          validationErrors.push(`Milestone ${i + 1}: Invalid actor address`);
        }

        if (!milestone.type || milestone.type.trim().length === 0) {
          validationErrors.push(`Milestone ${i + 1}: Type is required`);
        }
      }

      if (validationErrors.length > 0) {
        return JSON.stringify({ 
          success: false, 
          error: "Validation errors", 
          details: validationErrors 
        });
      }

      // Create milestones
      const results: any[] = [];
      const errors: any[] = [];

      for (let i = 0; i < milestones.length; i++) {
        const milestone = milestones[i];
        try {
          const result = await pool.query(
            `INSERT INTO milestones (nft_id, type, description, location, timestamp, actor_address)
             VALUES ($1, $2, $3, $4, NOW(), $5) RETURNING *`,
            [
              milestone.nftId,
              milestone.type.trim(),
              milestone.description?.trim() || null,
              milestone.location?.trim() || null,
              milestone.actorAddress,
            ]
          );

          results.push({
            index: i + 1,
            nftId: milestone.nftId,
            milestone: result.rows[0],
            success: true,
          });
        } catch (error: any) {
          errors.push({
            index: i + 1,
            nftId: milestone.nftId,
            error: error.message || "Unknown error",
          });
        }
      }

      return JSON.stringify({
        success: true,
        summary: {
          total: milestones.length,
          successful: results.length,
          failed: errors.length,
        },
        results,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error("Batch create milestones error:", error);
      return JSON.stringify({ 
        success: false, 
        error: error.message || "Unknown error occurred",
      });
    }
  },
});

