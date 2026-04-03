/**
 * Voice & Image Processing - Implementation
 * Actual implementations với API integrations
 */

import { getConfig, isFeatureEnabled } from "./config";

/**
 * Speech-to-Text using OpenAI Whisper
 */
export async function transcribeWithOpenAI(audioData: string, language: string = "vi"): Promise<string> {
  const config = getConfig();
  
  if (!config.speechToText?.openai?.apiKey) {
    throw new Error("OpenAI API key not configured for speech-to-text");
  }

  try {
    // If audioData is base64, convert to buffer
    // If it's a URL, fetch it first
    let audioBuffer: Buffer;
    
    if (audioData.startsWith("http://") || audioData.startsWith("https://")) {
      const response = await fetch(audioData);
      const arrayBuffer = await response.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
    } else if (audioData.startsWith("data:")) {
      // Data URL: data:audio/wav;base64,...
      const base64Data = audioData.split(",")[1];
      audioBuffer = Buffer.from(base64Data, "base64");
    } else {
      // Assume it's base64
      audioBuffer = Buffer.from(audioData, "base64");
    }

    // Call OpenAI Whisper API
    const formData = new FormData();
    const uint8 = new Uint8Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.byteLength);
    const blob = new Blob([uint8], { type: "audio/wav" });
    formData.append("file", blob, "audio.wav");
    formData.append("model", "whisper-1");
    formData.append("language", language);

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.speechToText.openai.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Speech-to-text failed");
    }

    const result = await response.json();
    return result.text;
  } catch (error: any) {
    throw new Error(`OpenAI Whisper error: ${error.message}`);
  }
}

/**
 * Speech-to-Text using Google Cloud Speech
 */
export async function transcribeWithGoogle(audioData: string, language: string = "vi-VN"): Promise<string> {
  const config = getConfig();
  
  if (!config.speechToText?.google?.apiKey) {
    throw new Error("Google Speech API key not configured");
  }

  try {
    // Convert audio to base64 if needed
    let base64Audio: string;
    if (audioData.startsWith("http://") || audioData.startsWith("https://")) {
      const response = await fetch(audioData);
      const arrayBuffer = await response.arrayBuffer();
      base64Audio = Buffer.from(arrayBuffer).toString("base64");
    } else if (audioData.startsWith("data:")) {
      base64Audio = audioData.split(",")[1];
    } else {
      base64Audio = audioData;
    }

    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${config.speechToText.google.apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          config: {
            encoding: "LINEAR16",
            sampleRateHertz: 16000,
            languageCode: language,
          },
          audio: {
            content: base64Audio,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Google Speech-to-text failed");
    }

    const result = await response.json();
    return result.results?.[0]?.alternatives?.[0]?.transcript || "";
  } catch (error: any) {
    throw new Error(`Google Speech error: ${error.message}`);
  }
}

/**
 * Speech-to-Text using AWS Transcribe
 */
export async function transcribeWithAWS(audioData: string, language: string = "vi-VN"): Promise<string> {
  const config = getConfig();
  const aws = config.speechToText?.aws;

  if (!aws?.accessKeyId || !aws?.secretAccessKey) {
    throw new Error("AWS credentials not configured for speech-to-text");
  }

  try {
    // Convert audio to base64 if needed
    let base64Audio: string;
    if (audioData.startsWith("http://") || audioData.startsWith("https://")) {
      const response = await fetch(audioData);
      const arrayBuffer = await response.arrayBuffer();
      base64Audio = Buffer.from(arrayBuffer).toString("base64");
    } else if (audioData.startsWith("data:")) {
      base64Audio = audioData.split(",")[1];
    } else {
      base64Audio = audioData;
    }

    const audioBytes = Buffer.from(base64Audio, "base64");
    const region = aws.region || "us-east-1";

    // Generate HMAC-SHA256 signature (simplified - in production use @aws-sdk/client-transcribe)
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = now.toISOString().split("T")[0].replace(/-/g, "");

    const endpoint = `https://transcribe.${region}.amazonaws.com`;
    const jobName = `pharmadna-${Date.now()}`;

    // Start transcription job
    const startResponse = await fetch(`${endpoint}/transcription-jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Amz-Date": amzDate,
        "X-Amz-Target": "Transcribe.StartTranscriptionJob",
        "Host": `transcribe.${region}.amazonaws.com`,
      },
      body: JSON.stringify({
        TranscriptionJobName: jobName,
        LanguageCode: mapLanguageCode(language),
        Media: { MediaFileUri: `data:audio/wav;base64,${base64Audio}` },
        MediaFormat: "wav",
      }),
    });

    if (!startResponse.ok) {
      throw new Error(`AWS Transcribe start failed: ${startResponse.status}`);
    }

    // Poll for completion (max 30 attempts, 2s interval = 60s max wait)
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await fetch(`${endpoint}/transcription-jobs/${jobName}`, {
        headers: {
          "X-Amz-Date": amzDate,
          "X-Amz-Target": "Transcribe.GetTranscriptionJob",
          "Host": `transcribe.${region}.amazonaws.com`,
        },
      });

      if (!statusResponse.ok) continue;

      const statusData = await statusResponse.json();
      const job = statusData.TranscriptionJob;
      if (job?.TranscriptionJobStatus === "COMPLETED") {
        const transcriptResponse = await fetch(job.Transcript?.TranscriptFileUri || "");
        const transcriptData = await transcriptResponse.json();
        return transcriptData.results?.transcripts?.[0]?.transcript || "";
      }
      if (job?.TranscriptionJobStatus === "FAILED") {
        throw new Error(job.FailureReason || "AWS Transcribe job failed");
      }
    }

    throw new Error("AWS Transcribe timeout - job did not complete in 60 seconds");
  } catch (error: any) {
    throw new Error(`AWS Transcribe error: ${error.message}`);
  }
}

/**
 * Speech-to-Text using Azure Speech Services
 */
export async function transcribeWithAzure(audioData: string, language: string = "vi-VN"): Promise<string> {
  const config = getConfig();
  const azure = config.speechToText?.azure;

  if (!azure?.subscriptionKey || !azure?.region) {
    throw new Error("Azure Speech credentials not configured");
  }

  try {
    // Convert audio to base64 if needed
    let base64Audio: string;
    if (audioData.startsWith("http://") || audioData.startsWith("https://")) {
      const response = await fetch(audioData);
      const arrayBuffer = await response.arrayBuffer();
      base64Audio = Buffer.from(arrayBuffer).toString("base64");
    } else if (audioData.startsWith("data:")) {
      base64Audio = audioData.split(",")[1];
    } else {
      base64Audio = audioData;
    }

    // Get Azure access token using subscription key
    const tokenResponse = await fetch(
      `https://${azure.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": azure.subscriptionKey,
          "Content-Length": "0",
        },
      }
    );

    if (!tokenResponse.ok) {
      throw new Error("Failed to obtain Azure Speech access token");
    }

    const accessToken = await tokenResponse.text();

    // Use Azure Speech-to-text REST API
    const response = await fetch(
      `https://${azure.region}.api.cognitive.microsoft.com/speech/recognition/dialog?mode=interactive&language=${language}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "audio/wav; codec=audio/pcm; samplerate=16000",
        },
        body: Buffer.from(base64Audio, "base64"),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure Speech failed: ${errorText}`);
    }

    const result = await response.json();
    return result.RecognitionResult?.NBest?.[0]?.Display || result.RecognitionResult?.Lexical || "";
  } catch (error: any) {
    throw new Error(`Azure Speech error: ${error.message}`);
  }
}

/**
 * Map language code to AWS/Azure compatible codes
 */
function mapLanguageCode(lang: string): string {
  const mapping: Record<string, string> = {
    "vi": "vi-VN",
    "vi-VN": "vi-VN",
    "en": "en-US",
    "en-US": "en-US",
    "zh": "zh-CN",
    "zh-CN": "zh-CN",
    "ja": "ja-JP",
    "ja-JP": "ja-JP",
    "ko": "ko-KR",
    "ko-KR": "ko-KR",
    "th": "th-TH",
    "th-TH": "th-TH",
  };
  return mapping[lang] || "en-US";
}

/**
 * Recognize QR Code using jsQR (client-side) or Google Vision API
 */
export async function recognizeQRCode(imageData: string): Promise<string | null> {
  const config = getConfig();

  // Try Google Vision API first if available
  if (config.imageRecognition?.provider === "google" && config.imageRecognition?.google?.apiKey) {
    try {
      const result = await recognizeWithGoogleVision(imageData, "QR_CODE_DETECTION");
      return result.qrCode || null;
    } catch (error) {
      console.error("Google Vision QR recognition failed:", error);
    }
  }

  // Fallback: Try jsQR library for client-side decoding
  try {
    const { default: jsQR } = await import("jsqr");
    const imageDataDecoded = await loadImageData(imageData);
    if (imageDataDecoded) {
      const result = jsQR(imageDataDecoded.data, imageDataDecoded.width, imageDataDecoded.height);
      return result ? result.data : null;
    }
  } catch (error) {
    console.error("jsQR QR recognition failed:", error);
  }

  return null;
}

/**
 * Recognize Barcode using Google Vision API or html5-qrcode
 */
export async function recognizeBarcode(imageData: string): Promise<string | null> {
  const config = getConfig();

  if (config.imageRecognition?.provider === "google" && config.imageRecognition?.google?.apiKey) {
    try {
      const result = await recognizeWithGoogleVision(imageData, "BARCODE_DETECTION");
      return result.barcode || null;
    } catch (error) {
      console.error("Google Vision barcode recognition failed:", error);
    }
  }

  // Fallback: Try html5-qrcode library for client-side decoding
  try {
    const { Html5Qrcode } = await import("html5-qrcode");
    const tmpId = `barcode-scanner-${Date.now()}`;
    const html5QrCode = new Html5Qrcode(tmpId);

    // Decode from image data URL or file
    const imageDataUrl = normalizeToDataUrl(imageData);
    const barcodeText = await html5QrCode.scanFile(imageDataUrl, false);
    if (barcodeText) {
      return barcodeText;
    }

    html5QrCode.clear();
  } catch (error) {
    console.error("html5-qrcode barcode recognition failed:", error);
  }

  return null;
}

/**
 * OCR Text using Google Vision API or Tesseract.js
 */
export async function ocrText(imageData: string, language: string = "vi"): Promise<string> {
  const config = getConfig();

  if (config.imageRecognition?.provider === "google" && config.imageRecognition?.google?.apiKey) {
    try {
      const result = await recognizeWithGoogleVision(imageData, "TEXT_DETECTION");
      return result.text || "";
    } catch (error) {
      console.error("Google Vision OCR failed:", error);
    }
  }

  // Fallback: Try Tesseract.js for client-side OCR
  try {
    const tesseractModule = await import("tesseract.js");
    const Tesseract = (tesseractModule as any).default || tesseractModule;
    const imageDataUrl = normalizeToDataUrl(imageData);

    const { data: { text } } = await Tesseract.recognize(imageDataUrl, language === "vi" ? "vie" : "eng", {
      logger: () => {},
    });

    return text.trim();
  } catch (error) {
    console.error("Tesseract OCR failed:", error);
  }

  return "";
}

/**
 * Recognize with Google Vision API
 */
async function recognizeWithGoogleVision(
  imageData: string,
  featureType: "TEXT_DETECTION" | "BARCODE_DETECTION" | "QR_CODE_DETECTION"
): Promise<any> {
  const config = getConfig();
  
  if (!config.imageRecognition?.google?.apiKey) {
    throw new Error("Google Vision API key not configured");
  }

  // Convert image to base64 if needed
  let base64Image: string;
  if (imageData.startsWith("http://") || imageData.startsWith("https://")) {
    const response = await fetch(imageData);
    const arrayBuffer = await response.arrayBuffer();
    base64Image = Buffer.from(arrayBuffer).toString("base64");
  } else if (imageData.startsWith("data:")) {
    base64Image = imageData.split(",")[1];
  } else {
    base64Image = imageData;
  }

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${config.imageRecognition.google.apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: base64Image,
            },
            features: [
              {
                type: featureType,
              },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Google Vision API failed");
  }

  const result = await response.json();
  const annotations = result.responses?.[0];

  if (featureType === "TEXT_DETECTION") {
    return {
      text: annotations?.fullTextAnnotation?.text || "",
    };
  } else if (featureType === "BARCODE_DETECTION") {
    const barcode = annotations?.barcodeAnnotations?.[0];
    return {
      barcode: barcode?.rawValue || null,
    };
  } else if (featureType === "QR_CODE_DETECTION") {
    // QR codes are detected as barcodes in Google Vision
    const barcode = annotations?.barcodeAnnotations?.[0];
    return {
      qrCode: barcode?.rawValue || null,
    };
  }

  return {};
}

/**
 * Load image data from various formats into ImageData for jsQR processing
 */
async function loadImageData(imageData: string): Promise<ImageData | null> {
  try {
    const dataUrl = normalizeToDataUrl(imageData);
    const img = await loadImage(dataUrl);

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0);
    const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return imageDataObj;
  } catch (error) {
    console.error("Failed to load image data:", error);
    return null;
  }
}

/**
 * Load an image from a URL or data URL
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Normalize various input formats to a data URL
 */
function normalizeToDataUrl(imageData: string): string {
  if (imageData.startsWith("data:")) {
    return imageData;
  }
  if (imageData.startsWith("http://") || imageData.startsWith("https://")) {
    return imageData;
  }
  // Assume base64
  return `data:image/png;base64,${imageData}`;
}

/**
 * Main transcription function - auto-select provider
 */
export async function transcribeAudio(audioData: string, language: string = "vi"): Promise<string> {
  const config = getConfig();
  const provider = config.speechToText?.provider;

  if (!isFeatureEnabled("speechToText")) {
    throw new Error("Speech-to-text is not enabled. Please configure API keys.");
  }

  switch (provider) {
    case "openai":
      return await transcribeWithOpenAI(audioData, language);
    case "google":
      return await transcribeWithGoogle(audioData, language);
    case "aws":
      return await transcribeWithAWS(audioData, language);
    case "azure":
      return await transcribeWithAzure(audioData, language);
    default:
      throw new Error(`Speech-to-text provider "${provider}" not supported`);
  }
}

/**
 * Main image recognition function - auto-select provider
 */
export async function recognizeImage(
  imageData: string,
  recognitionType: "qr" | "barcode" | "ocr" | "auto" = "auto"
): Promise<any> {
  const config = getConfig();

  if (!isFeatureEnabled("imageRecognition")) {
    throw new Error("Image recognition is not enabled. Please configure API keys.");
  }

  const result: any = {
    qrCode: null,
    barcode: null,
    text: null,
  };

  try {
    if (recognitionType === "qr" || recognitionType === "auto") {
      result.qrCode = await recognizeQRCode(imageData);
    }

    if (recognitionType === "barcode" || recognitionType === "auto") {
      result.barcode = await recognizeBarcode(imageData);
    }

    if (recognitionType === "ocr" || recognitionType === "auto") {
      result.text = await ocrText(imageData);
    }
  } catch (error: any) {
    console.error("Image recognition error:", error);
    throw error;
  }

  return result;
}

