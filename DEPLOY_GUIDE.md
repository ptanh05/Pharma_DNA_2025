# 🚀 Sui Contract Deployment Guide

Hướng dẫn deploy Sui smart contract cho PharmaDNA.

## Prerequisites

- Sui CLI đã được cài đặt
- Có SUI trong ví (testnet: dùng faucet)
- Đã build contract thành công: `sui move build`

## Bước 1: Setup Sui Client (nếu chưa có)

```bash
cd sui-contract

# Tạo address mới (nếu chưa có)
sui client new-address ed25519

# Hoặc import existing key
sui client import-key ed25519 YOUR_PRIVATE_KEY

# Switch sang testnet
sui client switch --env testnet

# Kiểm tra active address
sui client active-address
```

## Bước 2: Nạp SUI Testnet (nếu cần)

```bash
# Lấy active address
ACTIVE_ADDRESS=$(sui client active-address)

# Request từ faucet
curl -X POST "https://faucet.testnet.sui.io/gas" \
  -H "Content-Type: application/json" \
  -d "{\"FixedAmountRequest\":{\"recipient\":\"$ACTIVE_ADDRESS\"}}"

# Hoặc dùng web faucet: https://faucet.testnet.sui.io/
```

## Bước 3: Deploy Contract

```bash
cd sui-contract

# Deploy contract
sui client publish --gas-budget 100000000

# Output sẽ có dạng:
# Published Objects:
#   ┌──
#   │ PackageID: 0x...
#   │ PublishedAt: 0x...
#   └──
```

## Bước 4: Lưu Package ID và Contract Object ID

Sau khi deploy thành công, bạn sẽ nhận được:

1. **Package ID**: ID của package đã publish (dùng cho `SUI_PACKAGE_ID`)
2. **Published Object ID**: ID của contract object (dùng cho `SUI_CONTRACT_OBJECT_ID`)

Lưu các giá trị này vào `.env`:

```env
SUI_PACKAGE_ID=0x...
SUI_CONTRACT_OBJECT_ID=0x...
```

## Bước 5: Assign Roles (Sau khi deploy)

Sau khi deploy, bạn cần assign roles cho các addresses:

```bash
# Assign Manufacturer role
sui client call \
  --package SUI_PACKAGE_ID \
  --module pharma_nft \
  --function assign_role \
  --args SUI_CONTRACT_OBJECT_ID ADMIN_CAP_OBJECT_ID MANUFACTURER_ADDRESS 1 \
  --gas-budget 10000000

# Assign Distributor role
sui client call \
  --package SUI_PACKAGE_ID \
  --module pharma_nft \
  --function assign_role \
  --args SUI_CONTRACT_OBJECT_ID ADMIN_CAP_OBJECT_ID DISTRIBUTOR_ADDRESS 2 \
  --gas-budget 10000000

# Assign Pharmacy role
sui client call \
  --package SUI_PACKAGE_ID \
  --module pharma_nft \
  --function assign_role \
  --args SUI_CONTRACT_OBJECT_ID ADMIN_CAP_OBJECT_ID PHARMACY_ADDRESS 3 \
  --gas-budget 10000000
```

**Lưu ý**: `ADMIN_CAP_OBJECT_ID` là object ID của AdminCap được tạo khi deploy contract.

## Troubleshooting

### Lỗi "No active address"
```bash
sui client new-address ed25519
sui client active-address
```

### Lỗi "Insufficient gas"
- Nạp SUI từ faucet: https://faucet.testnet.sui.io/
- Hoặc dùng command: `curl -X POST "https://faucet.testnet.sui.io/gas" -H "Content-Type: application/json" -d '{"FixedAmountRequest":{"recipient":"YOUR_ADDRESS"}}'`

### Lỗi "Package ID not found"
- Kiểm tra contract đã được deploy chưa
- Kiểm tra `SUI_PACKAGE_ID` trong `.env` có đúng không

---

**Sau khi deploy thành công, cập nhật `.env` và test application!**

