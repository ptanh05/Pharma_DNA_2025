# ⚙️ Hướng dẫn Cấu hình Environment Variables

## 📋 Tạo file `.env`

Tạo file `.env` ở **root của dự án** và thêm các biến sau:

```env
# ============================================
# Database Configuration
# ============================================
DATABASE_URL=postgresql://user:password@host:port/database

# ============================================
# Blockchain Network Configuration
# ============================================
# Chọn network: "neo" hoặc "neo-testnet" (khuyến nghị: neo-testnet)
BLOCKCHAIN_NETWORK=neo-testnet

# ============================================
# Neo N3 Network Configuration (Recommended)
# ============================================
# Neo N3 Testnet (for development)
NEO_TESTNET_RPC=https://seed1t5.neo.org:20331
NEXT_PUBLIC_NEO_TESTNET_RPC=https://seed1t5.neo.org:20331
NEO_TESTNET_CHAIN_ID=844378958
NEXT_PUBLIC_NEO_TESTNET_CHAIN_ID=844378958
NEO_TESTNET_EXPLORER=https://testnet.neoscan.io
NEXT_PUBLIC_NEO_TESTNET_EXPLORER=https://testnet.neoscan.io

# Neo N3 Mainnet (for production)
# NEO_RPC=https://seed1.neo.org:10331
# NEXT_PUBLIC_NEO_RPC=https://seed1.neo.org:10331
# NEO_CHAIN_ID=860833102
# NEXT_PUBLIC_NEO_CHAIN_ID=860833102
# NEO_EXPLORER=https://neoscan.io
# NEXT_PUBLIC_NEO_EXPLORER=https://neoscan.io

# ============================================
# Neo N3 Contract Configuration
# ============================================
# Contract hash sau khi deploy (lấy từ neo-contract/.env)
NEO_CONTRACT_HASH=0x...
NEXT_PUBLIC_NEO_CONTRACT_HASH=0x...

# ============================================
# Smart Contract Configuration (Legacy - for backward compatibility)
# ============================================
# ⚠️ DEPRECATED: Sử dụng NEO_CONTRACT_HASH thay vì PHARMA_NFT_ADDRESS
# Giữ lại để backward compatibility với code cũ
NEXT_PUBLIC_PHARMA_NFT_ADDRESS=0x...

# ============================================
# Wallet Private Keys (Backend Only)
# ============================================
# ⚠️ BẢO MẬT: Không bao giờ commit private keys!
OWNER_PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# ============================================
# IPFS Configuration (Pinata)
# ============================================
PINATA_JWT=your_pinata_jwt_token_here

# ============================================
# AI Agent Configuration (Optional)
# ============================================
OPENAI_API_KEY=sk-your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo

# ============================================
# Environment
# ============================================
NODE_ENV=development
```

## 🔑 Lấy các giá trị cần thiết

### 1. DATABASE_URL
- **Neon**: Lấy từ dashboard → Connection String
- **Supabase**: Lấy từ Settings → Database → Connection String
- **Self-hosted**: `postgresql://user:password@host:port/database`

### 2. NEO_CONTRACT_HASH
- Deploy contract theo hướng dẫn: `neo-contract/README.md`
- Copy contract hash từ output của lệnh deploy
- Hoặc lấy từ file `neo-contract/.env` sau khi deploy

### 3. OWNER_PRIVATE_KEY
- Private key của ví deploy contract
- Lấy từ MetaMask: Account details → Export Private Key
- ⚠️ **KHÔNG BAO GIỜ** chia sẻ private key!

### 4. PINATA_JWT
- Đăng ký tại: https://app.pinata.cloud
- Tạo API Key: Developers → API Keys → New Key
- Copy JWT token

### 5. OPENAI_API_KEY (Optional)
- Đăng ký tại: https://platform.openai.com
- Tạo API Key: API Keys → Create new secret key
- Copy API key (bắt đầu bằng `sk-`)

## ✅ Checklist

- [ ] File `.env` đã được tạo ở root project
- [ ] `DATABASE_URL` đã được điền
- [ ] Contract đã được deploy (xem `neo-contract/README.md`)
- [ ] `NEO_CONTRACT_HASH` đã được điền
- [ ] `NEXT_PUBLIC_PHARMA_NFT_ADDRESS` đã được điền (nếu dùng code cũ)
- [ ] `OWNER_PRIVATE_KEY` đã được điền (private key của ví deploy)
- [ ] `PINATA_JWT` đã được điền (nếu dùng IPFS)
- [ ] `OPENAI_API_KEY` đã được điền (nếu dùng AI Agent)
- [ ] Đã restart Next.js server sau khi cập nhật `.env`

## 🔒 Bảo mật

- ⚠️ **KHÔNG BAO GIỜ** commit file `.env` lên Git
- ⚠️ **KHÔNG BAO GIỜ** chia sẻ private keys
- Thêm `.env` vào `.gitignore`
- Sử dụng `.env.example` làm template (không chứa giá trị thật)

## 📖 Xem thêm

- Deploy Contract: `neo-contract/README.md`
- README: `README.md`

