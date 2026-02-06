import { NextRequest } from "next/server";
import {
  testSpeechToText,
  testImageRecognition,
  testOCR,
} from "@/lib/ai-agent/test-utils";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateRequestBody }from "@/lib/utils/api-validator";
import { z } from "zod";

// POST request validation schema
const testDataSchema = z.object({
  type: z.enum(["speech", "image", "ocr"]),
  data: z.string().min(1, "Data is required"),
});

/**
 * POST /api/ai-agent/test
 * Test với actual data (audio/image)
 */
export async function POST(req: NextRequest) {
  try {
    const { type, data }= await validateRequestBody(req, testDataSchema);

    switch (type) {
      case "speech":
        const speechResult = await testSpeechToText(data);
        return createSuccessResponse({
          transcribed: speechResult.transcribed,
          error: speechResult.error,
        });

      case "image":
        const imageResult = await testImageRecognition(data);
        return createSuccessResponse({
          result: imageResult.result,
          error: imageResult.error,
        });

      case "ocr":
        const ocrResult = await testOCR(data);
        return createSuccessResponse({
          text: ocrResult.text,
          error: ocrResult.error,
        });

      default:
        throw new Error("Invalid test type");
    }
  } catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_TEST_POST");
  }
}

