/**
 * Test Utilities for AI Agent
 * Utilities để test các tính năng
 */

import { getConfig, isFeatureEnabled } from "./config";
import { transcribeAudio, recognizeImage, ocrText } from "./voice-image-impl";

/**
 * Test configuration
 */
export async function testConfiguration(): Promise<{
  success: boolean;
  results: Record<string, any>;
}> {
  const results: Record<string, any> = {};
  const config = getConfig();

  // Test OpenAI
  results.openai = {
    configured: !!config.openai?.apiKey,
    model: config.openai?.model || "not set",
    temperature: config.openai?.temperature,
  };

  // Test Speech-to-Text
  results.speechToText = {
    enabled: isFeatureEnabled("speechToText"),
    provider: config.speechToText?.provider || "none",
    configured: false,
  };

  if (config.speechToText?.provider === "openai") {
    results.speechToText.configured = !!config.openai?.apiKey;
  } else if (config.speechToText?.provider === "google") {
    results.speechToText.configured = !!config.speechToText?.google?.apiKey;
  }

  // Test Image Recognition
  results.imageRecognition = {
    enabled: isFeatureEnabled("imageRecognition"),
    provider: config.imageRecognition?.provider || "none",
    configured: false,
  };

  if (config.imageRecognition?.provider === "google") {
    results.imageRecognition.configured = !!config.imageRecognition?.google?.apiKey;
  }

  // Test WebSocket
  results.websocket = {
    enabled: isFeatureEnabled("websocket"),
    path: config.websocket?.path,
  };

  // Test Cost Optimization
  results.costOptimization = {
    enabled: isFeatureEnabled("costOptimization"),
    trackUsage: config.costOptimization?.trackUsage,
  };

  // Test Learning
  results.learning = {
    enabled: isFeatureEnabled("learning"),
    minPatternFrequency: config.learning?.minPatternFrequency,
  };

  const success = results.openai.configured && 
    (results.speechToText.enabled ? results.speechToText.configured : true) &&
    (results.imageRecognition.enabled ? results.imageRecognition.configured : true);

  return { success, results };
}

/**
 * Test Speech-to-Text với sample audio
 */
export async function testSpeechToText(audioData?: string): Promise<{
  success: boolean;
  transcribed?: string;
  error?: string;
}> {
  try {
    if (!isFeatureEnabled("speechToText")) {
      return {
        success: false,
        error: "Speech-to-text is not enabled. Check SPEECH_TO_TEXT_PROVIDER in .env",
      };
    }

    // If no audio provided, return test info
    if (!audioData) {
      return {
        success: true,
        transcribed: "No audio provided. Pass audioData (base64, data URL, or URL) to test.",
      };
    }

    const transcribed = await transcribeAudio(audioData, "vi");
    return {
      success: true,
      transcribed,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Test Image Recognition với sample image
 */
export async function testImageRecognition(
  imageData?: string,
  type: "qr" | "barcode" | "ocr" | "auto" = "auto"
): Promise<{
  success: boolean;
  result?: any;
  error?: string;
}> {
  try {
    if (!isFeatureEnabled("imageRecognition")) {
      return {
        success: false,
        error: "Image recognition is not enabled. Check IMAGE_RECOGNITION_PROVIDER in .env",
      };
    }

    if (!imageData) {
      return {
        success: true,
        result: {
          message: "No image provided. Pass imageData (base64, data URL, or URL) to test.",
        },
      };
    }

    const result = await recognizeImage(imageData, type);
    return {
      success: true,
      result,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Test OCR với sample image
 */
export async function testOCR(imageData?: string): Promise<{
  success: boolean;
  text?: string;
  error?: string;
}> {
  try {
    if (!isFeatureEnabled("imageRecognition")) {
      return {
        success: false,
        error: "Image recognition is not enabled. Check IMAGE_RECOGNITION_PROVIDER in .env",
      };
    }

    if (!imageData) {
      return {
        success: true,
        text: "No image provided. Pass imageData to test OCR.",
      };
    }

    const text = await ocrText(imageData, "vi");
    return {
      success: true,
      text,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Test tất cả features
 */
export async function testAllFeatures(): Promise<{
  config: any;
  speechToText: any;
  imageRecognition: any;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}> {
  const configTest = await testConfiguration();
  const speechTest = await testSpeechToText();
  const imageTest = await testImageRecognition();

  const tests = [
    { name: "Configuration", passed: configTest.success },
    { name: "Speech-to-Text", passed: speechTest.success },
    { name: "Image Recognition", passed: imageTest.success },
  ];

  const passed = tests.filter((t) => t.passed).length;
  const failed = tests.filter((t) => !t.passed).length;

  return {
    config: configTest.results,
    speechToText: speechTest,
    imageRecognition: imageTest,
    summary: {
      total: tests.length,
      passed,
      failed,
    },
  };
}

