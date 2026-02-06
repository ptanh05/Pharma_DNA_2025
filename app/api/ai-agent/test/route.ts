import { NextRequest } from "next/server";
import {
  testConfiguration,
  testSpeechToText,
  testImageRecognition,
  testOCR,
  testAllFeatures,
} from "@/lib/ai-agent/test-utils";
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/api-response";
import { validateQueryParams } from "@/lib/utils/api-validator";
import { z } from "zod";

// Query validation schema
const testQuerySchema = z.object({
  type: z.enum(["all", "config", "speech", "image", "ocr"]).default("all"),
});

/**
 * GET /api/ai-agent/test
 * Test AI Agent configuration và features
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { type } = validateQueryParams(searchParams, testQuerySchema);

    switch (type) {
      case "config":
        const configTest = await testConfiguration();
        return createSuccessResponse({
          config: configTest.results,
          message: configTest.success
            ? "Configuration is valid"
            : "Some configurations are missing",
        });

      case "speech":
        const speechTest = await testSpeechToText();
        return createSuccessResponse({
          result: speechTest,
          message: speechTest.success
            ? "Speech-to-text is configured correctly"
            : speechTest.error || "Speech-to-text test failed",
        });

      case "image":
        const imageTest = await testImageRecognition();
        return createSuccessResponse({
          result: imageTest,
          message: imageTest.success
            ? "Image recognition is configured correctly"
            : imageTest.error || "Image recognition test failed",
        });

      case "ocr":
        const ocrTest = await testOCR();
        return createSuccessResponse({
          result: ocrTest,
          message: ocrTest.success
            ? "OCR is configured correctly"
            : ocrTest.error || "OCR test failed",
        });

      case "all":
      default:
        const allTests = await testAllFeatures();
        return createSuccessResponse({
          ...allTests,
          message:
            allTests.summary.failed === 0
              ? "All features are configured correctly!"
              : `${allTests.summary.failed} test(s) failed`,
        });
    }
  } catch (error: any) {
    return createErrorResponse(error, "AI_AGENT_TEST_GET");
  }
}
