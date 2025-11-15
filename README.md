# PharmaDNA

PharmaDNA là hệ thống truy xuất nguồn gốc thuốc sử dụng Blockchain (Neo N3), AIoT và NFT để đảm bảo minh bạch, xác thực và quản lý chuỗi cung ứng dược phẩm.

**✅ Smart Contract**: Được viết bằng Python sử dụng Boa framework (neo3-boa) và deploy lên Neo N3 Testnet.

## Chức năng chính

- **Mint NFT cho lô thuốc**: Mỗi lô thuốc là một NFT duy nhất, lưu metadata trên IPFS.
- **Quản lý vận chuyển**: Nhà phân phối nhận lô, upload dữ liệu cảm biến, cập nhật trạng thái vận chuyển.
- **Nhà thuốc xác nhận nhập kho**: Quét QR hoặc nhập ID để xác minh và xác nhận nhập kho.
- **Quản trị viên**: Cấp quyền vai trò cho các ví trên contract và đồng bộ với backend.
- **Lịch sử vận chuyển**: Lưu và hiển thị các mốc vận chuyển (milestones) của từng lô thuốc.

## Cấu trúc thư mục

```
Pharma_DNA_saga_2025/
  app/                 # Next.js frontend & API routes
    manufacturer/      # Trang nhà sản xuất (mint NFT)
    distributor/       # Trang nhà phân phối (quản lý vận chuyển)
    pharmacy/          # Trang nhà thuốc (quét, xác nhận nhập kho)
    admin/             # Trang quản trị viên
    api/               # API backend (Next.js route handlers)
      manufacturer/    # API cho nhà sản xuất, milestone, transfer-request
      distributor/     # API cho nhà phân phối
      ...
  neo-contract/        # Smart contract (Python, Boa) - Deploy to Neo N3
  lib/                 # ABI, utils, db, blockchain utilities
  hooks/               # Custom React hooks
  components/          # UI components
  public/              # Ảnh, logo
  ...
```

## Cài đặt & chạy local

1. **Clone repo**
2. Cài dependencies:
   ```bash
   npm install
   # hoặc pnpm install
   ```
3. Tạo file `.env` với các biến:
   DATABASE_URL=

   **Blockchain Network Configuration (Neo N3):**
   - Set `BLOCKCHAIN_NETWORK=neo-testnet` or `neo` in `.env`
   - RPC URL: Configure in `.env` as `NEO_TESTNET_RPC` or `NEO_RPC`
   - Chain ID: Configure in `.env` as `NEO_TESTNET_CHAIN_ID` or `NEO_CHAIN_ID`
   - Block Explorer: Configure in `.env` as `NEO_TESTNET_EXPLORER` or `NEO_EXPLORER`
   - Native Currency: GAS (8 decimals)
   - Contract Hash: Configure in `.env` as `NEO_CONTRACT_HASH` (sau khi deploy)

4. Chạy migrate DB nếu cần (PostgreSQL)
5. Chạy app:
   ```bash
   npm run dev
   # hoặc pnpm dev
   ```
6. Deploy smart contract (Neo N3):
   ```bash
   cd neo-contract
   npm install
   npm run compile  # Compile Python contract to .nef
   npm run deploy   # Deploy to Neo N3 Testnet
   ```
   
   **📖 Xem hướng dẫn chi tiết:** `neo-contract/README.md`

## Các vai trò & luồng chính

- **Manufacturer**: Mint NFT, upload metadata, chỉ mint được khi có quyền trên contract.
- **Distributor**: Nhận lô đã được chấp thuận, upload dữ liệu cảm biến, cập nhật milestone.
- **Pharmacy**: Quét QR hoặc nhập ID, xác nhận nhập kho (milestone "Đã nhập kho").
- **Admin**: Cấp quyền cho ví, đồng bộ quyền lên contract (gọi assignRole).

## Lưu ý đặc biệt

- FE/BE chỉ cho phép thao tác khi ví có đúng quyền trên contract (kiểm tra trực tiếp on-chain).
- Mọi upload file đều lưu lên IPFS qua Pinata.
- Milestone lưu vào bảng `milestones` (PostgreSQL).
- Địa chỉ contract, private key, Pinata JWT phải bảo mật trong `.env`.
- Đảm bảo contract đã deploy đúng version, đúng enum Role.

## Các lệnh chính

- `npm run dev` — Chạy frontend/backend Next.js
- `cd neo-contract && npm run compile` — Compile Python contract
- `cd neo-contract && npm run deploy` — Deploy contract to Neo N3 Testnet

## Contract API (PharmaNFT - Neo N3)

- **NEP-11 Standard Methods:**
  - `symbol() -> str` — Token symbol ("PHARMA")
  - `decimals() -> int` — Token decimals (0 for NFT)
  - `totalSupply() -> int` — Total minted tokens
  - `balanceOf(owner: UInt160) -> int` — Balance of owner
  - `ownerOf(tokenId: bytes) -> UInt160` — Owner of token
  - `tokensOf(owner: UInt160) -> list` — All tokens owned by owner
  - `transfer(to: UInt160, tokenId: bytes, data: Any) -> bool` — Transfer token
  - `properties(tokenId: bytes) -> dict` — Token properties

- **Role Management:**
  - `assign_role(user: UInt160, role: int) -> bool` — Owner only
  - `revoke_role(user: UInt160) -> bool` — Owner only
  - `get_user_role(user: UInt160) -> int` — Get user role
  - `has_role(user: UInt160, role: int) -> bool` — Check role

- **NFT Lifecycle:**
  - `mint_product_nft(uri: str, batch_number: str, expiry_date: int) -> int` — Manufacturer only
  - `batch_mint_product_nft(uris: list, batch_numbers: list, expiry_dates: list) -> list` — Batch mint
  - `transfer_product_nft(token_id: int, to: UInt160) -> bool` — Transfer NFT
  - `admin_transfer(token_id: int, to: UInt160) -> bool` — Admin transfer
  - `get_product_current_owner(token_id: int) -> UInt160` — Get owner

- **Admin Controls:**
  - `pause() -> bool` / `unpause() -> bool` — Owner only
  - `set_transfer_restrictions(enabled: bool) -> bool` — Owner only

**Roles:** `0=None, 1=Manufacturer, 2=Distributor, 3=Pharmacy, 4=Admin`

## Đóng góp & phát triển

- Fork, PR, issue đều welcome!
- Đọc kỹ code trong `app/api/` và `neo-contract/` để hiểu luồng nghiệp vụ.

---

Mọi thắc mắc vui lòng liên hệ admin dự án hoặc tạo issue trên repo!
