# AI Agent - Quick Start Guide

## ✅ Bạn đã thêm API keys! Bây giờ hãy test và sử dụng

---

## 🧪 Bước 1: Test Configuration

### Test qua API:
```bash
# Test tất cả
curl http://localhost:3000/api/ai-agent/test

# Test riêng từng phần
curl http://localhost:3000/api/ai-agent/test?type=config
curl http://localhost:3000/api/ai-agent/test?type=speech
curl http://localhost:3000/api/ai-agent/test?type=image
```

### Hoặc trong browser:
```
http://localhost:3000/api/ai-agent/test
```

**Kết quả mong đợi:**
```json
{
  "success": true,
  "config": {
    "openai": { "configured": true, "model": "gpt-3.5-turbo" },
    "speechToText": { "enabled": true, "provider": "openai", "configured": true },
    "imageRecognition": { "enabled": true, "provider": "google", "configured": true }
  },
  "summary": { "total": 3, "passed": 3, "failed": 0 }
}
```

---

## 🎤 Bước 2: Test Speech-to-Text

### Test với audio file:

```typescript
// Frontend example
const audioFile = document.querySelector('input[type="file"]').files[0];
const reader = new FileReader();
reader.onload = async () => {
  const base64 = reader.result.split(',')[1];
  
  const response = await fetch('/api/ai-agent/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'speech',
      data: base64, // hoặc data URL: reader.result
    }),
  });
  
  const result = await response.json();
  console.log('Transcribed:', result.transcribed);
};
reader.readAsDataURL(audioFile);
```

### Hoặc dùng AI Agent trực tiếp:
```typescript
import { executeAgentTask } from "@/lib/ai-agent/core";

// Convert audio to base64 hoặc data URL
const audioData = "data:audio/wav;base64,...";

const result = await executeAgentTask(
  `Xử lý voice command từ audio này: ${audioData}`
);
```

---

## 🖼️ Bước 3: Test Image Recognition

### Test QR Code/Barcode:

```typescript
// Frontend example
const imageFile = document.querySelector('input[type="file"]').files[0];
const reader = new FileReader();
reader.onload = async () => {
  const response = await fetch('/api/ai-agent/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'image',
      data: reader.result, // data URL
    }),
  });
  
  const result = await response.json();
  console.log('QR Code:', result.result.qrCode);
  console.log('Barcode:', result.result.barcode);
  console.log('Text:', result.result.text);
};
reader.readAsDataURL(imageFile);
```

### Test OCR:

```typescript
const response = await fetch('/api/ai-agent/test', {
  method: 'POST',
  body: JSON.stringify({
    type: 'ocr',
    data: imageDataURL,
  }),
});

const result = await response.json();
console.log('Extracted text:', result.text);
```

### Hoặc dùng AI Agent:
```typescript
await executeAgentTask(
  `Nhận diện QR code từ image này: ${imageDataURL}`
);

await executeAgentTask(
  `Scan product label từ image này: ${imageDataURL}`
);
```

---

## 🚀 Bước 4: Sử dụng trong Production

### 1. Voice Command Processing

```typescript
// Trong component
const handleVoiceCommand = async (audioBlob: Blob) => {
  const reader = new FileReader();
  reader.onload = async () => {
    const audioData = reader.result; // data URL
    
    const response = await fetch('/api/ai-agent/execute', {
      method: 'POST',
      body: JSON.stringify({
        task: `Xử lý voice command: ${audioData}`,
        context: { role: 'manufacturer' },
      }),
    });
    
    const result = await response.json();
    // Agent sẽ tự động:
    // 1. Transcribe audio
    // 2. Execute command
    // Return result
  };
  reader.readAsDataURL(audioBlob);
};
```

### 2. QR Code Scanning

```typescript
const handleQRScan = async (imageData: string) => {
  const response = await fetch('/api/ai-agent/execute', {
    method: 'POST',
    body: JSON.stringify({
      task: `Nhận diện QR code và tra cứu NFT: ${imageData}`,
    }),
  });
  
  const result = await response.json();
  // Agent sẽ:
  // 1. Recognize QR code
  // 2. Lookup NFT by token ID/batch number
  // 3. Return NFT information
};
```

### 3. Product Label Scanning

```typescript
const handleLabelScan = async (imageData: string) => {
  const response = await fetch('/api/ai-agent/execute', {
    method: 'POST',
    body: JSON.stringify({
      task: `Scan product label và extract thông tin: ${imageData}`,
      context: { action: 'mint_nft' },
    }),
  });
  
  const result = await response.json();
  // Agent sẽ:
  // 1. Extract text using OCR
  // 2. Parse batch number, expiry date, etc.
  // 3. Suggest next action (mint NFT)
};
```

---

## 📝 Examples

### Example 1: Voice Command để Mint NFT

```typescript
// User nói: "Mint NFT cho lô thuốc Paracetamol, số lô LOT2024001"
const audioData = "..."; // Audio recording

await executeAgentTask(
  `Xử lý voice command: ${audioData}`
);

// Agent sẽ:
// 1. Transcribe: "Mint NFT cho lô thuốc Paracetamol, số lô LOT2024001"
// 2. Parse command
// 3. Execute mint_nft tool
// 4. Return result
```

### Example 2: Scan QR Code để Tra cứu

```typescript
// User scan QR code trên sản phẩm
const qrImage = "..."; // QR code image

await executeAgentTask(
  `Nhận diện QR code và tra cứu thông tin NFT: ${qrImage}`
);

// Agent sẽ:
// 1. Recognize QR code (token ID hoặc batch number)
// 2. Query database
// 3. Return NFT information
```

### Example 3: Scan Label để Mint NFT

```typescript
// User scan product label
const labelImage = "..."; // Product label image

await executeAgentTask(
  `Scan product label và mint NFT: ${labelImage}`
);

// Agent sẽ:
// 1. Extract text (batch number, expiry date, product name)
// 2. Parse structured data
// 3. Mint NFT với thông tin đã extract
// 4. Return transaction hash
```

---

## 🔍 Troubleshooting

### "Speech-to-text is not enabled"
- Check `SPEECH_TO_TEXT_PROVIDER` trong `.env`
- Verify `OPENAI_API_KEY` nếu dùng OpenAI
- Verify `GOOGLE_SPEECH_API_KEY` nếu dùng Google

### "Image recognition is not enabled"
- Check `IMAGE_RECOGNITION_PROVIDER` trong `.env`
- Verify `GOOGLE_VISION_API_KEY` và `GOOGLE_PROJECT_ID`
- Check API key có quyền Vision API

### "API key not configured"
- Verify key name trong `.env` đúng format
- Check không có spaces hoặc quotes thừa
- Restart server sau khi thêm keys

### Test fails
- Run test endpoint: `/api/ai-agent/test`
- Check error messages
- Verify API keys trong cloud console

---

## ✅ Checklist

- [ ] API keys đã thêm vào `.env`
- [ ] Test configuration: `/api/ai-agent/test?type=config`
- [ ] Test speech-to-text (nếu cần)
- [ ] Test image recognition (nếu cần)
- [ ] Test với actual data
- [ ] Integrate vào frontend components
- [ ] Test end-to-end workflow

---

## 🎉 Bạn đã sẵn sàng!

Tất cả tính năng đã được cấu hình và sẵn sàng sử dụng. Bắt đầu test và integrate vào ứng dụng của bạn!

**Need help?** Check:
- `API_KEYS_SETUP.md` - Chi tiết về API keys
- `FINAL_SUMMARY.md` - Tổng kết đầy đủ
- Test endpoint: `/api/ai-agent/test`

