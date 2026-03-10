/**
 * Voice & Image Processing Tools
 * Xử lý voice commands và image recognition
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { pool } from "@/lib/db";

/**
 * Tool: Process Voice Command
 * Xử lý voice command và chuyển thành text task
 */
export const processVoiceCommandTool = new DynamicStructuredTool({
  name: "process_voice_command",
  description: "Xử lý voice command và chuyển thành task cho AI Agent",
  schema: z.object({
    audioData: z.string().describe("Base64 encoded audio data, data URL, hoặc URL"),
    language: z.string().optional().describe("Language code (vi, en, etc.)"),
  }),
  func: async ({ audioData, language = "vi" }) => {
    try {
      const { transcribeAudio, isFeatureEnabled } = await import("./voice-image-impl");
      const { isFeatureEnabled: checkFeature } = await import("./config");

      if (!checkFeature("speechToText")) {
        return JSON.stringify({
          success: false,
          error: "Speech-to-text is not enabled. Please configure API keys in .env file.",
          note: "Add OPENAI_API_KEY or GOOGLE_SPEECH_API_KEY to enable this feature.",
        });
      }

      const transcribedText = await transcribeAudio(audioData, language);

      return JSON.stringify({
        success: true,
        transcribedText,
        language,
        message: "Voice command processed successfully. Use transcribed text as task for AI Agent.",
        suggestion: `Task: ${transcribedText}`,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || "Error processing voice command",
        note: "Make sure API keys are configured correctly in .env file",
      });
    }
  },
});

/**
 * Tool: Recognize Image (QR Code, Barcode, Label)
 * Nhận diện QR code, barcode, hoặc text từ image
 */
export const recognizeImageTool = new DynamicStructuredTool({
  name: "recognize_image",
  description: "Nhận diện QR code, barcode, hoặc text từ image để tra cứu NFT",
  schema: z.object({
    imageData: z.string().describe("Base64 encoded image, data URL, hoặc URL"),
    recognitionType: z.enum(["qr", "barcode", "ocr", "auto"]).describe("Loại nhận diện"),
  }),
  func: async ({ imageData, recognitionType = "auto" }) => {
    try {
      const { recognizeImage } = await import("./voice-image-impl");
      const { isFeatureEnabled } = await import("./config");

      if (!isFeatureEnabled("imageRecognition")) {
        return JSON.stringify({
          success: false,
          error: "Image recognition is not enabled. Please configure API keys in .env file.",
          note: "Add GOOGLE_VISION_API_KEY or AWS credentials to enable this feature.",
        });
      }

      const recognitionResult = await recognizeImage(imageData, recognitionType);

      const result: any = {
        success: true,
        recognitionType,
        detected: false,
        ...recognitionResult,
      };

      // If NFT token ID or batch number detected, look it up
      const identifier = recognitionResult.qrCode || recognitionResult.barcode || recognitionResult.text;
      
      if (identifier) {
        // Try to find NFT by token ID or batch number
        const nftResult = await pool.query(
          `SELECT * FROM nfts 
           WHERE token_id::text = $1 OR batch_number = $1 
           LIMIT 1`,
          [identifier]
        );

        if (nftResult.rows.length > 0) {
          result.nft = nftResult.rows[0];
          result.detected = true;
          result.message = `NFT found: ${nftResult.rows[0].name} (ID: ${nftResult.rows[0].id})`;
        } else {
          result.message = `Identifier detected: ${identifier}, but no matching NFT found`;
        }
      } else {
        result.message = "No QR code, barcode, or text detected in image";
      }

      return JSON.stringify(result);
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || "Error recognizing image",
        note: "Make sure API keys are configured correctly in .env file",
      });
    }
  },
});

/**
 * Tool: Scan Product Label
 * Scan và extract thông tin từ product label
 */
export const scanProductLabelTool = new DynamicStructuredTool({
  name: "scan_product_label",
  description: "Scan product label và extract thông tin (batch number, expiry date, etc.)",
  schema: z.object({
    imageData: z.string().describe("Base64 encoded image, data URL, hoặc URL của product label"),
  }),
  func: async ({ imageData }) => {
    try {
      const { ocrText } = await import("./voice-image-impl");
      const { isFeatureEnabled } = await import("./config");

      if (!isFeatureEnabled("imageRecognition")) {
        return JSON.stringify({
          success: false,
          error: "Image recognition is not enabled. Please configure API keys in .env file.",
        });
      }

      // Extract text using OCR
      const extractedText = await ocrText(imageData, "vi");

      if (!extractedText || extractedText.trim().length === 0) {
        return JSON.stringify({
          success: false,
          error: "No text detected in image. Please ensure the image is clear and contains readable text.",
        });
      }

      // Parse structured data from text
      const extractedData: any = {
        rawText: extractedText,
        batchNumber: null,
        expiryDate: null,
        productName: null,
        manufacturer: null,
        otherInfo: {},
      };

      // Extract batch number (patterns: LOT, Batch, Lô, etc.)
      const batchPatterns = [
        /(?:LOT|Batch|Lô|Số lô)[\s:]*([A-Z0-9\-]+)/i,
        /(?:LOT|Batch|Lô)[\s]*#?[\s]*([A-Z0-9\-]+)/i,
        /([A-Z]{2,}\d{4,})/,
      ];
      for (const pattern of batchPatterns) {
        const match = extractedText.match(pattern);
        if (match) {
          extractedData.batchNumber = match[1];
          break;
        }
      }

      // Extract expiry date (patterns: HSD, Exp, Hạn dùng, etc.)
      const expiryPatterns = [
        /(?:HSD|Exp|Hạn dùng|Expiry)[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
      ];
      for (const pattern of expiryPatterns) {
        const match = extractedText.match(pattern);
        if (match) {
          extractedData.expiryDate = match[1];
          break;
        }
      }

      // Extract product name (usually first line or after "Tên thuốc", "Product", etc.)
      const productNamePatterns = [
        /(?:Tên thuốc|Product|Sản phẩm)[\s:]*([^\n]+)/i,
        /^([A-Z][^\n]{5,})/m,
      ];
      for (const pattern of productNamePatterns) {
        const match = extractedText.match(pattern);
        if (match) {
          extractedData.productName = match[1].trim();
          break;
        }
      }

      // Extract manufacturer
      const manufacturerPatterns = [
        /(?:NSX|Manufacturer|Nhà sản xuất)[\s:]*([^\n]+)/i,
      ];
      for (const pattern of manufacturerPatterns) {
        const match = extractedText.match(pattern);
        if (match) {
          extractedData.manufacturer = match[1].trim();
          break;
        }
      }

      return JSON.stringify({
        success: true,
        extractedData,
        message: "Product label scanned successfully",
        note: extractedData.batchNumber 
          ? `Batch number detected: ${extractedData.batchNumber}. You can use this to mint or lookup NFT.`
          : "Some information may not have been detected. Please verify manually.",
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || "Error scanning product label",
        note: "Make sure API keys are configured correctly in .env file",
      });
    }
  },
});

/**
 * Helper: Recognize QR Code (placeholder)
 */
async function recognizeQRCode(imageData: string): Promise<string | null> {
  // In production, use:
  // - jsQR library for browser
  // - ZXing for server
  // - Google Cloud Vision API
  return null;
}

/**
 * Helper: Recognize Barcode (placeholder)
 */
async function recognizeBarcode(imageData: string): Promise<string | null> {
  // In production, use:
  // - quaggaJS
  // - ZXing
  // - Google Cloud Vision API
  return null;
}

/**
 * Helper: OCR Text (placeholder)
 */
async function ocrText(imageData: string): Promise<string | null> {
  // In production, use:
  // - Tesseract.js
  // - Google Cloud Vision API
  // - AWS Textract
  // - Azure Computer Vision
  return null;
}

