# PharmaNFT Neo N3 Smart Contract

Smart contract cho PharmaDNA trên Neo N3 blockchain, viết bằng Python sử dụng Boa framework.

## 📋 Yêu cầu

- Python 3.8+
- Node.js 18+
- Neo N3 Testnet account với GAS

## 🚀 Cài đặt

### 1. Cài đặt Python dependencies

```bash
pip install -r requirements.txt
```

### 2. Cài đặt Node.js dependencies

```bash
npm install
```

## 📝 Compile Contract

```bash
# Compile Python contract to NEF
neo3-boa compile PharmaNFT.py
```

**Lưu ý**: Nếu lệnh `neo3-boa` không tìm thấy, thử:
```bash
python -m boa compile PharmaNFT.py
```

Sau khi compile, bạn sẽ có:
- `PharmaNFT.nef` - Compiled contract
- `PharmaNFT.manifest.json` - Contract manifest

## 🔧 Cấu hình

Tạo file `.env` trong thư mục `neo-contract/`:

```env
# Deployer Account
DEPLOYER_PRIVATE_KEY=your_private_key_here
DEPLOYER_ADDRESS=your_address_here

# Neo N3 Testnet
NEO_TESTNET_RPC=https://seed1t5.neo.org:20331
NEO_TESTNET_EXPLORER=https://testnet.neoscan.io
```

**⚠️ Lưu ý**: 
- Private key phải bắt đầu với `0x` hoặc không có prefix
- Đảm bảo account có đủ GAS để deploy (ít nhất 10 GAS)
- Lấy testnet GAS từ: https://neowish.ngd.network/

## 🚀 Deploy Contract

```bash
npm run deploy
```

Script sẽ:
1. Load contract files
2. Check deployer balance
3. Deploy contract lên Neo N3 Testnet
4. Chờ confirmation
5. Lưu contract hash vào `.env`

## 📖 Contract Functions

### Role Management
- `assign_role(user: UInt160, role: int)` - Assign role (owner only)
- `revoke_role(user: UInt160)` - Revoke role (owner only)
- `get_role(user: UInt160)` - Get user role
- `has_role(user: UInt160, role: int)` - Check role

### NFT Lifecycle
- `mint_product_nft(uri: str, batch_number: str, expiry_date: int)` - Mint NFT (manufacturer only)
- `transfer_product_nft(token_id: int, to: UInt160)` - Transfer NFT
- `admin_transfer(token_id: int, to: UInt160)` - Admin transfer

### View Functions
- `get_product_nft_data(token_id: int)` - Get token data
- `get_product_history(token_id: int)` - Get token history
- `get_product_current_owner(token_id: int)` - Get current owner
- `is_product_expired(token_id: int)` - Check if expired

### Admin Functions
- `pause()` - Pause contract (owner only)
- `unpause()` - Unpause contract (owner only)
- `update_product_expiry(token_id: int, expiry_timestamp: int)` - Update expiry
- `mark_product_expired(token_id: int)` - Mark expired (admin only)

## 🧪 Testing

```bash
# Run tests
npm test
```

## 📚 Tài liệu

- [Neo Documentation](https://docs.neo.org/)
- [Boa Framework](https://github.com/CityOfZion/boa)
- [neon-js SDK](https://github.com/CityOfZion/neon-js)

## 🔗 Links

- Neo N3 Testnet Explorer: https://testnet.neoscan.io
- Neo Testnet Faucet: https://neowish.ngd.network/
- Neo Developer Portal: https://developers.neo.org/

