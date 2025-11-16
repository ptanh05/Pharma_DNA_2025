import { NextRequest, NextResponse } from "next/server";
import {
  testConfiguration,
  testSpeechToText,
  testImageRecognition,
  testOCR,
  testAllFeatures,
} from "@/lib/ai-agent/test-utils";

/**
 * GET /api/ai-agent/test
 * Test AI Agent configuration và features
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const testType = searchParams.get("type") || "all"; // all, config, speech, image, ocr

    switch (testType) {
      case "config":
        const configTest = await testConfiguration();
        return NextResponse.json({
          success: configTest.success,
          config: configTest.results,
          message: configTest.success
            ? "Configuration is valid"
            : "Some configurations are missing. Check .env file.",
        });

      case "speech":
        const speechTest = await testSpeechToText();
        return NextResponse.json({
          success: speechTest.success,
          result: speechTest,
          message: speechTest.success
            ? "Speech-to-text is configured correctly"
            : speechTest.error || "Speech-to-text test failed",
        });

      case "image":
        const imageTest = await testImageRecognition();
        return NextResponse.json({
          success: imageTest.success,
          result: imageTest,
          message: imageTest.success
            ? "Image recognition is configured correctly"
            : imageTest.error || "Image recognition test failed",
        });

      case "ocr":
        const ocrTest = await testOCR();
        return NextResponse.json({
          success: ocrTest.success,
          result: ocrTest,
          message: ocrTest.success
            ? "OCR is configured correctly"
            : ocrTest.error || "OCR test failed",
        });

      case "all":
      default:
        const allTests = await testAllFeatures();
        return NextResponse.json({
          success: allTests.summary.failed === 0,
          ...allTests,
          message:
            allTests.summary.failed === 0
              ? "All features are configured correctly!"
              : `${allTests.summary.failed} test(s) failed. Check configuration.`,
        });
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "Test error",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai-agent/test
 * Test với actual data (audio/image)
 */
export async function POST(req: NextRequest) {
  try {
    const { type, data } = await req.json(); // type: "speech" | "image" | "ocr", data: base64/URL

    if (!type || !data) {
      return NextResponse.json(
        { error: "Missing type or data" },
        { status: 400 }
      );
    }

    switch (type) {
      case "speech":
        const speechResult = await testSpeechToText(data);
        return NextResponse.json({
          success: speechResult.success,
          transcribed: speechResult.transcribed,
          error: speechResult.error,
        });

      case "image":
        const imageResult = await testImageRecognition(data);
        return NextResponse.json({
          success: imageResult.success,
          result: imageResult.result,
          error: imageResult.error,
        });

      case "ocr":
        const ocrResult = await testOCR(data);
        return NextResponse.json({
          success: ocrResult.success,
          text: ocrResult.text,
          error: ocrResult.error,
        });

      default:
        return NextResponse.json(
          { error: "Invalid test type. Use: speech, image, or ocr" },
          { status: 400 }
        );
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "Test error",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}

