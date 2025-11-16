# API Keys Setup Guide

Hướng dẫn cấu hình API keys cho các tính năng AI Agent.

## 📋 Tổng quan

Các tính năng AI Agent cần API keys từ các services khác nhau. Bạn chỉ cần thêm keys vào file `.env` là có thể sử dụng.

## 🔑 Required Keys

### 1. OpenAI (Bắt buộc cho AI Agent core)
```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_TEMPERATURE=0.3
OPENAI_MAX_TOKENS=2000
```

**Cách lấy:**
1. Đăng ký tại https://platform.openai.com
2. Tạo API key tại https://platform.openai.com/api-keys
3. Copy key vào `.env`

**Cost:** ~$0.002 per 1K tokens (GPT-3.5-turbo)

---

## 🎤 Speech-to-Text (Optional)

### Option 1: OpenAI Whisper (Recommended - dùng chung key với OpenAI)
```env
SPEECH_TO_TEXT_PROVIDER=openai
OPENAI_API_KEY=sk-...  # Reuse OpenAI key
```

**Cost:** $0.006 per minute

### Option 2: Google Cloud Speech-to-Text
```env
SPEECH_TO_TEXT_PROVIDER=google
GOOGLE_SPEECH_API_KEY=...
GOOGLE_PROJECT_ID=...
```

**Cách lấy:**
1. Tạo project tại https://console.cloud.google.com
2. Enable Speech-to-Text API
3. Tạo service account và download JSON key
4. Extract API key từ JSON

**Cost:** $0.006 per 15 seconds

### Option 3: AWS Transcribe
```env
SPEECH_TO_TEXT_PROVIDER=aws
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

**Cách lấy:**
1. Tạo IAM user tại AWS Console
2. Attach policy: AmazonTranscribeFullAccess
3. Tạo access keys

**Cost:** $0.024 per minute

### Option 4: Azure Speech Services
```env
SPEECH_TO_TEXT_PROVIDER=azure
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=...
```

**Cách lấy:**
1. Tạo Speech resource tại Azure Portal
2. Copy key và region

**Cost:** $1 per hour

---

## 🖼️ Image Recognition (Optional)

### Option 1: Google Cloud Vision API (Recommended)
```env
IMAGE_RECOGNITION_PROVIDER=google
GOOGLE_VISION_API_KEY=...
GOOGLE_PROJECT_ID=...
```

**Cách lấy:**
1. Enable Vision API trong Google Cloud Console
2. Tạo API key tại APIs & Services > Credentials
3. Restrict key để chỉ dùng Vision API

**Cost:** 
- OCR: $1.50 per 1,000 images
- Barcode/QR: Free (first 1,000/month)

### Option 2: AWS Rekognition
```env
IMAGE_RECOGNITION_PROVIDER=aws
AWS_ACCESS_KEY_ID=...  # Reuse from speech if using AWS
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

**Cách lấy:**
1. Tạo IAM user với AmazonRekognitionFullAccess
2. Tạo access keys

**Cost:** $1.00 per 1,000 images

### Option 3: Azure Computer Vision
```env
IMAGE_RECOGNITION_PROVIDER=azure
AZURE_VISION_KEY=...
AZURE_VISION_ENDPOINT=https://...cognitiveservices.azure.com/
```

**Cách lấy:**
1. Tạo Computer Vision resource tại Azure Portal
2. Copy key và endpoint

**Cost:** $1 per 1,000 transactions

### Option 4: Tesseract.js (Local - Free, no API key)
```env
IMAGE_RECOGNITION_PROVIDER=tesseract
TESSERACT_LANGUAGE=eng
```

**Note:** Chạy local, không cần API key nhưng accuracy thấp hơn.

---

## ⚙️ Configuration

### WebSocket
```env
WEBSOCKET_ENABLED=true
WEBSOCKET_PATH=/api/ai-agent/ws
WEBSOCKET_CORS_ORIGIN=*
```

### Cost Optimization
```env
COST_OPTIMIZATION_ENABLED=true
COST_ALERT_THRESHOLD=100  # USD
```

### Learning System
```env
LEARNING_ENABLED=true
MIN_PATTERN_FREQUENCY=3
```

---

## 🚀 Quick Start

### Minimal Setup (Chỉ AI Agent core)
```env
OPENAI_API_KEY=sk-...
```

### Full Setup (Tất cả tính năng)
```env
# Core
OPENAI_API_KEY=sk-...

# Speech-to-Text
SPEECH_TO_TEXT_PROVIDER=openai

# Image Recognition
IMAGE_RECOGNITION_PROVIDER=google
GOOGLE_VISION_API_KEY=...
GOOGLE_PROJECT_ID=...

# WebSocket
WEBSOCKET_ENABLED=true

# Cost & Learning
COST_OPTIMIZATION_ENABLED=true
LEARNING_ENABLED=true
```

---

## 💡 Recommendations

### Budget-Friendly Setup
- **OpenAI GPT-3.5-turbo** cho AI Agent (cheapest)
- **OpenAI Whisper** cho Speech-to-Text (reuse key)
- **Google Vision API** cho Image Recognition (good free tier)

### Best Quality Setup
- **OpenAI GPT-4** cho AI Agent (better quality)
- **Google Cloud Speech** cho Speech-to-Text (best accuracy)
- **Google Vision API** cho Image Recognition (best OCR)

### Free/Local Setup
- **OpenAI GPT-3.5-turbo** cho AI Agent (required)
- **Tesseract.js** cho Image Recognition (local, free)
- Speech-to-Text: Disable hoặc dùng OpenAI Whisper

---

## 🔒 Security Notes

1. **Never commit `.env` file** - Add to `.gitignore`
2. **Use environment-specific keys** - Different keys for dev/prod
3. **Restrict API keys** - Limit to specific IPs/domains when possible
4. **Rotate keys regularly** - Change keys every 90 days
5. **Monitor usage** - Set up billing alerts

---

## 📊 Cost Estimation

### Typical Usage (1000 requests/month):
- **OpenAI GPT-3.5-turbo**: ~$5-10
- **Speech-to-Text (Whisper)**: ~$2-5
- **Image Recognition (Google)**: ~$1-3
- **Total**: ~$8-18/month

### Heavy Usage (10,000 requests/month):
- **OpenAI GPT-3.5-turbo**: ~$50-100
- **Speech-to-Text**: ~$20-50
- **Image Recognition**: ~$10-30
- **Total**: ~$80-180/month

---

## ❓ Troubleshooting

### "API key not configured" error
- Check `.env` file exists
- Verify key name matches exactly
- Restart server after adding keys

### "Feature not enabled" error
- Check provider is set correctly (not "none")
- Verify API key is valid
- Check service is enabled in cloud console

### High costs
- Enable cost optimization
- Use caching
- Monitor usage in cloud dashboards
- Set billing alerts

---

## 📞 Support

Nếu gặp vấn đề:
1. Check `.env` file format
2. Verify API keys are valid
3. Check service status pages
4. Review error logs

