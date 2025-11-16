/**
 * AI Agent Configuration
 * Centralized config cho tất cả API keys và settings
 */

export interface AIConfig {
  // OpenAI
  openai?: {
    apiKey?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };

  // Speech-to-Text Services
  speechToText?: {
    provider: "google" | "aws" | "azure" | "openai" | "none";
    google?: {
      apiKey?: string;
      projectId?: string;
    };
    aws?: {
      accessKeyId?: string;
      secretAccessKey?: string;
      region?: string;
    };
    azure?: {
      subscriptionKey?: string;
      region?: string;
    };
    openai?: {
      apiKey?: string;
    };
  };

  // Image Recognition Services
  imageRecognition?: {
    provider: "google" | "aws" | "azure" | "tesseract" | "none";
    google?: {
      apiKey?: string;
      projectId?: string;
    };
    aws?: {
      accessKeyId?: string;
      secretAccessKey?: string;
      region?: string;
    };
    azure?: {
      subscriptionKey?: string;
      endpoint?: string;
    };
    tesseract?: {
      // Tesseract.js runs locally, no API key needed
      language?: string;
    };
  };

  // WebSocket
  websocket?: {
    enabled: boolean;
    path?: string;
    cors?: {
      origin?: string | string[];
      methods?: string[];
    };
  };

  // Cost Optimization
  costOptimization?: {
    enabled: boolean;
    trackUsage: boolean;
    alertThreshold?: number; // USD
  };

  // Learning
  learning?: {
    enabled: boolean;
    minPatternFrequency?: number;
  };
}

let config: AIConfig = {};

/**
 * Initialize config from environment variables
 */
export function initializeConfig(): AIConfig {
  config = {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || "0.3"),
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || "2000"),
    },

    speechToText: {
      provider: (process.env.SPEECH_TO_TEXT_PROVIDER as any) || "none",
      google: {
        apiKey: process.env.GOOGLE_SPEECH_API_KEY,
        projectId: process.env.GOOGLE_PROJECT_ID,
      },
      aws: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || "us-east-1",
      },
      azure: {
        subscriptionKey: process.env.AZURE_SPEECH_KEY,
        region: process.env.AZURE_SPEECH_REGION,
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY, // Reuse OpenAI key for Whisper
      },
    },

    imageRecognition: {
      provider: (process.env.IMAGE_RECOGNITION_PROVIDER as any) || "none",
      google: {
        apiKey: process.env.GOOGLE_VISION_API_KEY,
        projectId: process.env.GOOGLE_PROJECT_ID,
      },
      aws: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || "us-east-1",
      },
      azure: {
        subscriptionKey: process.env.AZURE_VISION_KEY,
        endpoint: process.env.AZURE_VISION_ENDPOINT,
      },
      tesseract: {
        language: process.env.TESSERACT_LANGUAGE || "eng",
      },
    },

    websocket: {
      enabled: process.env.WEBSOCKET_ENABLED !== "false",
      path: process.env.WEBSOCKET_PATH || "/api/ai-agent/ws",
      cors: {
        origin: process.env.WEBSOCKET_CORS_ORIGIN || "*",
        methods: ["GET", "POST"],
      },
    },

    costOptimization: {
      enabled: process.env.COST_OPTIMIZATION_ENABLED !== "false",
      trackUsage: true,
      alertThreshold: parseFloat(process.env.COST_ALERT_THRESHOLD || "100"),
    },

    learning: {
      enabled: process.env.LEARNING_ENABLED !== "false",
      minPatternFrequency: parseInt(process.env.MIN_PATTERN_FREQUENCY || "3"),
    },
  };

  return config;
}

/**
 * Get config
 */
export function getConfig(): AIConfig {
  if (Object.keys(config).length === 0) {
    return initializeConfig();
  }
  return config;
}

/**
 * Update config
 */
export function updateConfig(updates: Partial<AIConfig>): AIConfig {
  config = { ...config, ...updates };
  return config;
}

/**
 * Check if feature is enabled
 */
export function isFeatureEnabled(feature: keyof AIConfig): boolean {
  const cfg = getConfig();
  switch (feature) {
    case "speechToText":
      return cfg.speechToText?.provider !== "none" && cfg.speechToText?.provider !== undefined;
    case "imageRecognition":
      return cfg.imageRecognition?.provider !== "none" && cfg.imageRecognition?.provider !== undefined;
    case "websocket":
      return cfg.websocket?.enabled !== false;
    case "costOptimization":
      return cfg.costOptimization?.enabled !== false;
    case "learning":
      return cfg.learning?.enabled !== false;
    default:
      return true;
  }
}

// Initialize on module load
if (typeof window === "undefined") {
  initializeConfig();
}

