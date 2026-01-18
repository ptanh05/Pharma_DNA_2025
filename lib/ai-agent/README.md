# AI Agent System - PharmaDNA

Hệ thống AI Agent tự động điều phối chuỗi cung ứng dược phẩm trên Sui blockchain.

## 📋 Tổng quan

AI Agent sử dụng LangChain và OpenAI GPT để tự động hóa các tác vụ trong chuỗi cung ứng:
- Mint và transfer NFT
- Tạo milestones
- Phân tích dữ liệu
- Phát hiện gian lận
- Tối ưu hóa routes
- Giám sát hệ thống

## 🛠️ Tools Available

### Core Tools (lib/ai-agent/core.ts)
1. **mint_nft** - Mint NFT mới cho lô thuốc
2. **transfer_nft** - Chuyển quyền sở hữu NFT
3. **create_milestone** - Tạo milestone trong quá trình vận chuyển
4. **query_database** - Truy vấn database
5. **send_notification** - Gửi thông báo
6. **analyze_sensor_data** - Phân tích dữ liệu cảm biến AIoT

### Additional Tools (lib/ai-agent/tools.ts)
7. **auto_approve_transfer_requests** - Tự động duyệt transfer requests hợp lệ
8. **generate_report** - Tạo báo cáo tổng hợp (daily/weekly/monthly)
9. **check_system_health** - Kiểm tra sức khỏe hệ thống

### Advanced Tools (lib/ai-agent/tools-advanced.ts)
10. **predict_quality** - Dự đoán chất lượng sản phẩm dựa trên sensor data và lịch sử
11. **detect_fraud** - Phát hiện gian lận và bất thường trong chuỗi cung ứng
12. **optimize_route** - Tối ưu hóa route vận chuyển cho nhiều NFT/điểm đến

### Batch Tools (lib/ai-agent/tools-batch.ts)
13. **batch_mint_nfts** - Mint nhiều NFT cùng lúc từ danh sách sản phẩm
14. **batch_transfer_nfts** - Transfer nhiều NFT cùng lúc
15. **batch_create_milestones** - Tạo milestones cho nhiều NFT cùng lúc

### Smart Tools (lib/ai-agent/tools-smart.ts)
16. **smart_notifications** - Gửi thông báo thông minh dựa trên context và priority
17. **auto_recovery** - Tự động phục hồi từ lỗi (stuck NFTs, failed transfers, expired products)
18. **intelligent_monitoring** - Giám sát thông minh và phát hiện patterns

## 📁 Cấu trúc Files

```
lib/ai-agent/
├── core.ts              # Core agent system và basic tools
├── tools.ts             # Additional tools (approve, report, health)
├── tools-advanced.ts    # Advanced tools (predict, fraud, route)
├── tools-batch.ts       # Batch operations tools
├── tools-smart.ts       # Smart tools (notifications, recovery, monitoring)
├── validator.ts         # Input validation utilities
├── rate-limiter.ts      # Rate limiting system
├── memory.ts            # Conversation memory management
├── cache.ts             # Result caching
└── security.ts          # Security và audit logging
```

## 🔧 Validation

File `validator.ts` cung cấp các hàm validate:
- `validateAddress()` - Validate Sui address
- `validateTokenId()` - Validate token ID
- `validateIPFSHash()` - Validate IPFS hash
- `validateBatchNumber()` - Validate batch number
- `validateExpiryDate()` - Validate expiry date
- `validateRole()` - Validate role
- `validateStringLength()` - Validate string length
- `validateEmail()` - Validate email
- `validateArray()` - Validate array với item validator

## ⚡ Rate Limiting

File `rate-limiter.ts` quản lý rate limiting:
- Default: 10 requests/minute, 100/hour, 1000/day
- Custom limits cho admin và manufacturer
- Auto cleanup old entries

## 💾 Memory & Cache

- **Memory**: Lưu conversation history và context (lib/ai-agent/memory.ts)
- **Cache**: Cache kết quả để tiết kiệm cost (lib/ai-agent/cache.ts)

## 🔒 Security

File `security.ts` cung cấp:
- Audit logging
- Permission checks
- Input sanitization
- SQL injection prevention

## 📊 Usage Examples

### Mint NFT
```
"Mint NFT cho lô thuốc Paracetamol, IPFS hash QmXXX..., batch LOT2024001"
```

### Batch Mint
```
"Mint 10 NFT từ danh sách sản phẩm trong file Excel"
```

### Predict Quality
```
"Dự đoán chất lượng cho NFT #123"
```

### Detect Fraud
```
"Phát hiện gian lận trong hệ thống"
```

### Auto Recovery
```
"Tự động phục hồi các NFT bị stuck trong transit"
```

### Intelligent Monitoring
```
"Giám sát performance hệ thống trong 24h qua"
```

## 🚀 API Endpoints

- `POST /api/ai-agent/execute` - Execute agent task
- `GET /api/ai-agent/health` - System health check
- `GET /api/ai-agent/analytics` - Analytics data
- `GET /api/ai-agent/history` - Task history
- `GET /api/ai-agent/audit-logs` - Audit logs

## 📝 Notes

- Tất cả tools đều validate inputs trước khi xử lý
- Rate limiting được áp dụng tự động
- Audit logs được ghi lại cho mọi action
- Results được cache để tiết kiệm cost
- Memory được lưu theo session để maintain context

## 🔄 Integration với Sui Blockchain

AI Agent sử dụng các functions từ `lib/blockchain/contract`:
- `mintProductNFT()`
- `transferProductNFT()`
- `getTokenProperties()`
- `getRole()`
- `isProductExpired()`

Tất cả đều sử dụng Sui SDK (@mysten/sui.js).

