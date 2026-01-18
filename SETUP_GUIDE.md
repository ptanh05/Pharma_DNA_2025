# 🚀 PharmaDNA Setup Guide - Neon.tech & Pinata

Hướng dẫn setup chi tiết cho PharmaDNA sử dụng Neon.tech (PostgreSQL) và Pinata (IPFS).

## 📋 Prerequisites

- Node.js 18.x trở lên
- Tài khoản [Neon.tech](https://neon.tech) (free tier available)
- Tài khoản [Pinata](https://pinata.cloud) (free tier available)
- Tài khoản [OpenAI](https://platform.openai.com) (cho AI Agent)
- Sui wallet (Sui Wallet, Suiet, etc.)

## 🔧 Step-by-Step Setup

### 1. Clone và Install Dependencies

```bash
git clone <repository-url>
cd Pharma_DNA_saga_2025
npm install --legacy-peer-deps
```

### 2. Setup Neon.tech Database

#### 2.1. Tạo Database trên Neon.tech

1. Truy cập [https://console.neon.tech](https://console.neon.tech)
2. Đăng nhập hoặc tạo tài khoản mới
3. Tạo **Project** mới (hoặc sử dụng project có sẵn)
4. Copy **Connection String** từ dashboard
   - Format: `postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`

#### 2.2. Chạy Database Migration

**Option 1: Sử dụng psql (khuyến nghị)**
```bash
# Windows (PowerShell)
$env:PGPASSWORD="your-password"; psql "postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require" -f database/migration_sui.sql

# Linux/Mac
psql "postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require" < database/migration_sui.sql
```

**Option 2: Sử dụng Neon CLI**
```bash
# Cài đặt Neon CLI
npm install -g neonctl

# Login
neonctl auth

# Chạy migration
neonctl db execute --database-name neondb --file database/migration_sui.sql
```

**Option 3: Sử dụng Neon Web SQL Editor**
1. Vào Neon dashboard → SQL Editor
2. Copy nội dung file `database/migration_sui.sql`
3. Paste và chạy trong SQL Editor

### 3. Setup Pinata IPFS

#### 3.1. Tạo tài khoản Pinata

1. Truy cập [https://pinata.cloud](https://pinata.cloud)
2. Đăng ký/đăng nhập tài khoản (free tier: 1GB storage)

#### 3.2. Lấy JWT Token

1. Vào **Account Settings** → **API Keys**
2. Click **New Key**
3. Đặt tên key (ví dụ: "PharmaDNA")
4. Chọn permissions:
   - ✅ `pinFileToIPFS`
   - ✅ `pinJSONToIPFS`
   - ✅ `unpin`
5. Copy **JWT Token** (bắt đầu với `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

#### 3.3. Test Pinata Connection

```bash
curl -X GET "https://api.pinata.cloud/data/testAuthentication" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Nếu thành công sẽ trả về: `{"authenticated": true}`

### 4. Setup Sui Blockchain

#### 4.1. Cài đặt Sui CLI

**Windows:**
- Download từ [Sui Releases](https://github.com/MystenLabs/sui/releases)
- Hoặc dùng WSL/Linux subsystem

**Linux/Mac:**
```bash
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch devnet sui
```

#### 4.2. Deploy Smart Contract

```bash
cd sui-contract

# Build contract
sui move build

# Deploy contract (testnet)
sui client publish --gas-budget 100000000

# Lưu lại Package ID và Contract Object ID
# Package ID: 0x...
# Contract Object ID: 0x...
```

#### 4.3. Nạp SUI Testnet (nếu cần)

```bash
# Sử dụng faucet
curl -X POST "https://faucet.testnet.sui.io/gas" \
  -H "Content-Type: application/json" \
  -d '{"FixedAmountRequest":{"recipient":"YOUR_SUI_ADDRESS"}}'
```

### 5. Cấu hình Environment Variables

Tạo file `.env` trong thư mục root:

```env
# ============================================
# Database (Neon.tech)
# ============================================
DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require

# ============================================
# Sui Blockchain
# ============================================
BLOCKCHAIN_NETWORK=sui-testnet
SUI_PACKAGE_ID=0x...  # Package ID từ bước deploy contract
SUI_CONTRACT_OBJECT_ID=0x...  # Contract Object ID từ bước deploy contract
SUI_TESTNET_RPC=https://fullnode.testnet.sui.io:443
SUI_MAINNET_RPC=https://fullnode.mainnet.sui.io:443

# Owner private key (hex format: 0x...)
OWNER_PRIVATE_KEY=0x...

# ============================================
# OpenAI (AI Agent)
# ============================================
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-3.5-turbo

# ============================================
# IPFS (Pinata)
# ============================================
PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # JWT từ Pinata dashboard

# ============================================
# Optional: Distributor (nếu cần auto-transfer)
# ============================================
DISTRIBUTOR_PRIVATE_KEY=0x...
```

### 6. Test Application

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) và test:

1. **Kết nối Sui Wallet**
   - Click "Connect Wallet" ở header
   - Chọn Sui wallet (Sui Wallet, Suiet, etc.)

2. **Test Mint NFT** (Manufacturer)
   - Vào `/manufacturer`
   - Upload metadata và files
   - Mint NFT

3. **Test Transfer** (Distributor)
   - Vào `/distributor`
   - Transfer NFT đến Pharmacy

4. **Test Lookup** (Consumer)
   - Vào `/lookup`
   - Quét QR code hoặc nhập Object ID

## 🔍 Verify Setup

### Kiểm tra Database Connection

```bash
# Test connection
psql "YOUR_DATABASE_URL" -c "SELECT version();"
```

### Kiểm tra Pinata

```bash
curl -X GET "https://api.pinata.cloud/data/testAuthentication" \
  -H "Authorization: Bearer YOUR_PINATA_JWT"
```

### Kiểm tra Sui Contract

```bash
cd sui-contract
sui client object SUI_PACKAGE_ID
```

## 🐛 Troubleshooting

### Database Connection Issues

**Lỗi: "Connection timeout"**
- Kiểm tra DATABASE_URL có đúng không
- Kiểm tra Neon.tech project có đang active không
- Kiểm tra firewall/network

**Lỗi: "SSL required"**
- Đảm bảo connection string có `?sslmode=require`

### Pinata Issues

**Lỗi: "Unauthorized"**
- Kiểm tra PINATA_JWT có đúng không
- Kiểm tra API key có đủ permissions không
- Kiểm tra API key có expired không

**Lỗi: "File too large"**
- Free tier Pinata giới hạn 1GB
- Nâng cấp plan hoặc compress files

### Sui Issues

**Lỗi: "Package ID not found"**
- Kiểm tra SUI_PACKAGE_ID trong .env
- Đảm bảo contract đã được deploy
- Kiểm tra network (testnet/mainnet) có đúng không

**Lỗi: "Insufficient gas"**
- Nạp SUI vào ví: https://faucet.testnet.sui.io/
- Kiểm tra OWNER_PRIVATE_KEY có đúng không

## 📚 Resources

- [Neon.tech Documentation](https://neon.tech/docs)
- [Pinata Documentation](https://docs.pinata.cloud)
- [Sui Documentation](https://docs.sui.io)
- [Sui TypeScript SDK](https://github.com/MystenLabs/sui/tree/main/sdk/typescript)

## ✅ Checklist

- [ ] Database created trên Neon.tech
- [ ] Database migration đã chạy thành công
- [ ] Pinata account created và JWT token đã lấy
- [ ] Sui CLI đã cài đặt
- [ ] Smart contract đã deploy
- [ ] Package ID và Contract Object ID đã lưu vào .env
- [ ] Tất cả environment variables đã cấu hình
- [ ] Application chạy thành công (`npm run dev`)
- [ ] Test kết nối wallet thành công
- [ ] Test mint NFT thành công
- [ ] Test transfer NFT thành công

---

**Happy Coding! 🚀**

