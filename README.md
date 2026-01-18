# 🏥 PharmaDNA - Pharmaceutical Supply Chain Tracking System

> Blockchain-based pharmaceutical supply chain tracking system using Sui Network, AIoT, and NFT technology

[![Next.js](https://img.shields.io/badge/Next.js-14.2.16-black)](https://nextjs.org/)
[![Sui](https://img.shields.io/badge/Blockchain-Sui-blue)](https://sui.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## 📋 Tổng quan

PharmaDNA là hệ thống truy xuất nguồn gốc thuốc sử dụng công nghệ Blockchain (Sui), AIoT và NFT để đảm bảo tính minh bạch, xác thực và quản lý toàn bộ chuỗi cung ứng dược phẩm từ nhà sản xuất đến người tiêu dùng.

### ✨ Tính năng chính

- 🔗 **Blockchain Integration**: Mỗi lô thuốc được đại diện bởi một NFT duy nhất trên Sui Network
- 🤖 **AI Agent System**: Hệ thống AI tự động điều phối và quản lý chuỗi cung ứng với 21 tools
- 📱 **Multi-Role Dashboard**: Giao diện riêng cho từng vai trò (Manufacturer, Distributor, Pharmacy, Admin)
- 🔍 **Real-time Tracking**: Theo dõi real-time vị trí và trạng thái của từng lô thuốc
- 📊 **Analytics & Reporting**: Báo cáo và phân tích dữ liệu với ML predictions
- 🎤 **Voice & Image Processing**: Xử lý voice commands và nhận diện QR code/barcode
- 🔔 **Smart Notifications**: Hệ thống thông báo thông minh và webhooks
- 🔐 **Role-Based Access Control**: Quản lý quyền truy cập dựa trên vai trò

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Manufacturer│ │Distributor│ │ Pharmacy │ │  Admin   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Next.js API)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              AI Agent System (LangChain)              │  │
│  │  • 21 Tools  • Workflow Automation  • Learning       │  │
│  │  • ML Analytics  • Webhooks  • Voice/Image Processing│  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Sui         │    │  PostgreSQL  │    │  IPFS        │
│  Blockchain  │    │  Database    │    │  (Pinata)    │
└──────────────┘    └──────────────┘    └──────────────┘
```

## 🚀 Bắt đầu

### Yêu cầu hệ thống

- **Node.js**: 18.x trở lên
- **PostgreSQL**: 12.x trở lên
- **Sui Wallet**: Sui Wallet, Suiet hoặc wallet tương thích
- **Sui CLI**: Để deploy smart contract (tùy chọn)

### Cài đặt

1. **Clone repository**
   ```bash
   git clone <repository-url>
   cd Pharma_DNA_saga_2025
   ```

2. **Cài đặt dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Setup Database (Neon.tech)**
   
   - Tạo database trên [Neon.tech](https://neon.tech)
   - Copy connection string từ dashboard
   - Chạy migration:
   ```bash
   psql "YOUR_NEON_CONNECTION_STRING" < database/migration_sui.sql
   ```

4. **Setup Pinata IPFS**
   
   - Tạo tài khoản trên [Pinata](https://pinata.cloud)
   - Lấy JWT Token từ API Keys section

5. **Cấu hình environment variables**
   
   Tạo file `.env` trong thư mục root:
   ```env
   # Database (Neon.tech)
   DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require

   # Sui Blockchain
   BLOCKCHAIN_NETWORK=sui-testnet  # hoặc sui-mainnet, sui-devnet
   SUI_PACKAGE_ID=0x...  # Package ID sau khi deploy contract
   SUI_CONTRACT_OBJECT_ID=0x...  # Contract object ID
   SUI_TESTNET_RPC=https://fullnode.testnet.sui.io:443
   SUI_MAINNET_RPC=https://fullnode.mainnet.sui.io:443
   OWNER_PRIVATE_KEY=0x...  # Private key format: hex string

   # OpenAI (cho AI Agent)
   OPENAI_API_KEY=sk-...

   # IPFS (Pinata)
   PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # JWT từ Pinata dashboard

   # Optional: Voice & Image Processing
   SPEECH_TO_TEXT_PROVIDER=openai
   IMAGE_RECOGNITION_PROVIDER=google
   GOOGLE_VISION_API_KEY=...
   GOOGLE_PROJECT_ID=...
   ```
   
   📖 Xem hướng dẫn chi tiết trong [SETUP_GUIDE.md](./SETUP_GUIDE.md)

6. **Deploy Smart Contract** (tùy chọn)
   ```bash
   cd sui-contract
   
   # Cài đặt Sui CLI (nếu chưa có)
   cargo install --locked --git https://github.com/MystenLabs/sui.git --branch devnet sui
   
   # Build contract
   sui move build
   
   # Deploy contract (testnet)
   sui client publish --gas-budget 100000000
   
   # Lưu lại Package ID và Contract Object ID vào .env
   ```

7. **Chạy development server**
   ```bash
   npm run dev
   ```

   Mở [http://localhost:3000](http://localhost:3000) trong browser

## 📁 Cấu trúc dự án

```
Pharma_DNA_saga_2025/
├── app/                      # Next.js App Router
│   ├── api/                 # API Routes
│   │   ├── admin/          # Admin APIs
│   │   ├── manufacturer/   # Manufacturer APIs
│   │   ├── distributor/    # Distributor APIs
│   │   ├── pharmacy/       # Pharmacy APIs
│   │   └── ai-agent/       # AI Agent APIs
│   ├── manufacturer/        # Manufacturer dashboard
│   ├── distributor/         # Distributor dashboard
│   ├── pharmacy/            # Pharmacy dashboard
│   ├── admin/               # Admin dashboard
│   └── lookup/              # NFT lookup page
│
├── lib/
│   ├── ai-agent/           # AI Agent System
│   │   ├── core.ts        # Core orchestrator (21 tools)
│   │   ├── workflow.ts    # Workflow automation
│   │   ├── learning.ts    # Learning & adaptation
│   │   ├── analytics-ml.ts # ML analytics
│   │   └── ...            # Other AI modules
│   ├── blockchain/         # Sui integration
│   │   ├── contract-sui.ts
│   │   ├── provider-sui.ts
│   │   ├── config-sui.ts
│   │   └── ...
│   └── ...
│
├── components/              # React components
│   ├── AIAgentPanel.tsx
│   ├── AIAgentChat.tsx
│   ├── NFTCard.tsx
│   └── ...
│
├── sui-contract/           # Smart Contract
│   ├── sources/
│   │   └── pharma_nft.move  # Main contract (Sui Move)
│   └── Move.toml
│
└── database/               # Database schemas
    └── migration_sui.sql
```

## 🎯 Các vai trò và luồng nghiệp vụ

### 👨‍🔬 Manufacturer (Nhà sản xuất)
- Mint NFT cho lô thuốc mới
- Upload metadata lên IPFS
- Tạo milestones trong quá trình sản xuất
- Gửi transfer request cho Distributor

### 🚚 Distributor (Nhà phân phối)
- Nhận và xác nhận transfer requests
- Upload dữ liệu cảm biến (nhiệt độ, độ ẩm)
- Tạo milestones trong quá trình vận chuyển
- Chuyển NFT đến Pharmacy

### 💊 Pharmacy (Nhà thuốc)
- Quét QR code để tra cứu NFT
- Xác nhận nhập kho
- Tạo milestone "Đã nhập kho"
- Quản lý inventory

### 👨‍💼 Admin (Quản trị viên)
- Cấp quyền cho các ví trên blockchain
- Đồng bộ quyền với smart contract
- Quản lý users và roles
- Monitor system health

## 🤖 AI Agent System

Hệ thống AI Agent với 21 tools tự động điều phối toàn bộ chuỗi cung ứng:

### Core Tools
- `mint_nft`: Mint NFT mới
- `transfer_nft`: Chuyển quyền sở hữu NFT
- `create_milestone`: Tạo milestone
- `query_database`: Truy vấn database
- `send_notification`: Gửi thông báo
- `analyze_sensor_data`: Phân tích dữ liệu cảm biến

### Advanced Tools
- `predict_quality`: Dự đoán chất lượng sản phẩm
- `detect_fraud`: Phát hiện gian lận
- `optimize_route`: Tối ưu hóa route vận chuyển

### Batch Operations
- `batch_mint_nfts`: Mint nhiều NFT cùng lúc
- `batch_transfer_nfts`: Transfer nhiều NFT
- `batch_create_milestones`: Tạo milestones hàng loạt

### Smart Features
- `smart_notifications`: Thông báo thông minh
- `auto_recovery`: Tự động phục hồi từ lỗi
- `intelligent_monitoring`: Giám sát thông minh

### Voice & Image
- `process_voice_command`: Xử lý voice commands
- `recognize_image`: Nhận diện QR code, barcode, OCR
- `scan_product_label`: Scan và extract thông tin từ label

### Additional
- `auto_approve_transfer_requests`: Tự động duyệt transfer requests
- `generate_report`: Tạo báo cáo tổng hợp
- `check_system_health`: Kiểm tra sức khỏe hệ thống

## 🔧 Tech Stack

### Frontend
- **Framework**: Next.js 14.2.16 (App Router)
- **UI Library**: React 18 + shadcn/ui
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts

### Backend
- **Runtime**: Node.js (Next.js API Routes)
- **Database**: PostgreSQL
- **Blockchain SDK**: @mysten/sui.js, @mysten/wallet-kit

### Smart Contract
- **Language**: Move
- **Framework**: Sui Move
- **Standard**: Sui Objects (NFT)

### AI Agent
- **Framework**: LangChain v0.3.0
- **LLM**: OpenAI GPT-3.5-turbo
- **Tools**: DynamicStructuredTool (Zod schemas)

### IPFS
- **Service**: Pinata
- **Library**: axios + form-data

## 📚 API Documentation

### Blockchain APIs

#### Mint NFT
```typescript
POST /api/manufacturer/mint
Body: {
  ipfsHash: string;
  account: string;
  batchNumber?: string;
  expiryDate?: number;
}
```

#### Transfer NFT
```typescript
POST /api/distributor/transfer-to-pharmacy
Body: {
  nftId: string | number;  // Sui object ID (string) hoặc token ID (number)
  pharmacyAddress: string;  // Sui address (0x...)
}
```

### AI Agent APIs

#### Execute Task
```typescript
POST /api/ai-agent/execute
Body: {
  task: string;
  context?: any;
  sessionId?: string;
  userId?: string;
}
```

#### Test Configuration
```typescript
GET /api/ai-agent/test?type=config
```

Xem thêm API documentation trong `docs/` folder.

## 🧪 Testing

### Test AI Agent Configuration
```bash
curl http://localhost:3000/api/ai-agent/test
```

### Test với actual data
```bash
# Test speech-to-text
curl -X POST http://localhost:3000/api/ai-agent/test \
  -H "Content-Type: application/json" \
  -d '{"type": "speech", "data": "base64_audio_data"}'

# Test image recognition
curl -X POST http://localhost:3000/api/ai-agent/test \
  -H "Content-Type: application/json" \
  -d '{"type": "image", "data": "base64_image_data"}'
```

## 🚀 Deployment

### Vercel

1. **Push code lên GitHub**

2. **Import project vào Vercel**
   - Vào [Vercel Dashboard](https://vercel.com)
   - Click "Import Project"
   - Chọn repository

3. **Thêm Environment Variables**
   - Vào Settings > Environment Variables
   - Thêm tất cả variables từ `.env`

4. **Deploy**
   - Vercel sẽ tự động deploy khi push code

### Manual Deployment

```bash
# Build
npm run build

# Start production server
npm start
```

## 📝 Smart Contract

### Deploy Contract

```bash
cd sui-contract

# Cài đặt Sui CLI (nếu chưa có)
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch devnet sui

# Build contract
sui move build

# Deploy contract (testnet)
sui client publish --gas-budget 100000000

# Lưu lại Package ID và Contract Object ID vào .env
```

### Contract Methods

#### Role Management
- `assign_role(contract: &mut PharmaNFTContract, admin_cap: &AdminCap, user: address, role: u8)`
- `get_user_role(contract: &PharmaNFTContract, user: address): u8`

#### NFT Lifecycle
- `mint_product_nft(contract: &mut PharmaNFTContract, uri: vector<u8>, batch_number: vector<u8>, expiry_date: u64)`
- `transfer_product_nft(nft: &mut PharmaNFT, contract: &PharmaNFTContract, to: address, clock: &Clock)`
- `admin_transfer(nft: &mut PharmaNFT, contract: &PharmaNFTContract, admin_cap: &AdminCap, to: address)`

#### View Functions
- `is_product_expired(nft: &PharmaNFT, clock: &Clock): bool`
- `get_nft_properties(nft: &PharmaNFT): (String, String, u64, bool, vector<address>)`

**Roles**: `0=None, 1=Manufacturer, 2=Distributor, 3=Pharmacy, 4=Admin`

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Sui](https://sui.io/) - Blockchain platform
- [LangChain](https://www.langchain.com/) - AI framework
- [Next.js](https://nextjs.org/) - React framework
- [shadcn/ui](https://ui.shadcn.com/) - UI components

## 📞 Support

Nếu gặp vấn đề:
1. Check documentation trong `docs/` folder
2. Test configuration: `/api/ai-agent/test`
3. Review error logs
4. Check API keys trong `.env`

------

**Made with ❤️ for Pharmaceutical Supply Chain Transparency**

