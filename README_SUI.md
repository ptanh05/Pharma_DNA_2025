# PharmaDNA - Sui Blockchain Setup Guide

Hướng dẫn setup và deploy PharmaDNA trên Sui blockchain.

## 🚀 Quick Start

### 1. Cài đặt Dependencies

```bash
npm install --legacy-peer-deps
```

### 2. Setup Database (Neon.tech)

1. **Tạo database trên Neon.tech**:
   - Truy cập [https://neon.tech](https://neon.tech)
   - Tạo project mới hoặc sử dụng project có sẵn
   - Copy connection string từ dashboard

2. **Chạy migration**:
   ```bash
   # Sử dụng connection string từ Neon.tech
   psql "postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require" < database/migration_sui.sql
   
   # Hoặc dùng Neon CLI (nếu đã cài)
   neonctl db execute --database-name neondb --file database/migration_sui.sql
   ```

### 3. Setup Pinata IPFS

1. **Tạo tài khoản Pinata**:
   - Truy cập [https://pinata.cloud](https://pinata.cloud)
   - Đăng ký/đăng nhập tài khoản

2. **Lấy JWT Token**:
   - Vào **API Keys** trong dashboard
   - Tạo API Key mới hoặc sử dụng existing key
   - Copy **JWT Token**

### 4. Cấu hình Environment Variables

Tạo file `.env` trong thư mục root:

```env
# Database (Neon.tech)
DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require

# Sui Configuration
BLOCKCHAIN_NETWORK=sui-testnet  # hoặc sui-mainnet, sui-devnet
SUI_PACKAGE_ID=0x...  # Package ID sau khi deploy contract
SUI_CONTRACT_OBJECT_ID=0x...  # Contract object ID
SUI_TESTNET_RPC=https://fullnode.testnet.sui.io:443
SUI_MAINNET_RPC=https://fullnode.mainnet.sui.io:443

# Private key format: hex string (0x...) hoặc base64
OWNER_PRIVATE_KEY=0x...

# OpenAI (cho AI Agent)
OPENAI_API_KEY=sk-...

# IPFS (Pinata)
PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # JWT token từ Pinata dashboard
```

### 5. Deploy Smart Contract

**Option 1: Sử dụng script (khuyến nghị)**

```powershell
# Windows PowerShell
.\scripts\deploy-sui-contract.ps1
```

Script sẽ tự động:
- Setup Sui client nếu chưa có
- Build contract
- Deploy contract
- Hiển thị Package ID và Contract Object ID

**Option 2: Deploy thủ công**

```bash
cd sui-contract

# Setup Sui client (nếu chưa có)
sui client new-address ed25519
sui client switch --env testnet

# Build contract
sui move build

# Deploy contract (testnet)
sui client publish --gas-budget 100000000

# Lưu lại Package ID và Contract Object ID vào .env
```

📖 Xem hướng dẫn chi tiết trong [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)

### 6. Chạy Application

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) trong browser.

## 📝 Sui Address Format

- **Format**: Hex string, 66 ký tự, bắt đầu với `0x`
- **Ví dụ**: `0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`

## 🔑 Sui Object ID Format

- **Format**: Hex string, 66 ký tự, bắt đầu với `0x`
- **Ví dụ**: `0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890`

## 📚 Tài liệu tham khảo

- [Sui Documentation](https://docs.sui.io/)
- [Sui TypeScript SDK](https://github.com/MystenLabs/sui/tree/main/sdk/typescript)
- [Sui Move Language](https://docs.sui.io/build/move)
- [Wallet Kit](https://github.com/MystenLabs/sui/tree/main/sdk/wallet-kit)

## 🔧 Troubleshooting

### Lỗi "Package ID not found"
- Kiểm tra `SUI_PACKAGE_ID` trong `.env`
- Đảm bảo contract đã được deploy

### Lỗi "Insufficient gas"
- Nạp SUI vào ví: https://faucet.testnet.sui.io/

### Wallet không kết nối
- Đảm bảo đã cài Sui wallet extension (Sui Wallet, Suiet, etc.)
- Kiểm tra WalletProvider đã được wrap trong layout

---

**Made with ❤️ for Pharmaceutical Supply Chain Transparency**
