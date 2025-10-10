# PharmaDNA

PharmaDNA là hệ thống truy xuất nguồn gốc thuốc sử dụng Blockchain (PharmaDNA chainlet), AIoT và NFT để đảm bảo minh bạch, xác thực và quản lý chuỗi cung ứng dược phẩm.

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
  saga-contract/       # Smart contract (Solidity, Hardhat)
  lib/                 # ABI, utils, db
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

   ```env
   # Database Configuration
   DATABASE_URL=postgres://username:password@host:port/database

   # PharmaDNA Chainlet Configuration
   PHARMA_NFT_ADDRESS=0xaa3f88a6b613985f3D97295D6BAAb6246c2699c6
   NEXT_PUBLIC_PHARMA_NFT_ADDRESS=0xaa3f88a6b613985f3D97295D6BAAb6246c2699c6
   OWNER_PRIVATE_KEY=your_private_key_here

   # IPFS Configuration (Pinata)
   PINATA_JWT=your_pinata_jwt_token_here
   ```

   **PharmaDNA Chainlet Details:**

   - Chain ID: `2759821881746000` (0x9ce0b1ae7a250)
   - RPC URL: `https://pharmadna-2759821881746000-1.jsonrpc.sagarpc.io`
   - Block Explorer: `https://pharmadna-2759821881746000-1.sagaexplorer.io`
   - Native Currency: `PDNA`

4. Chạy migrate DB nếu cần (PostgreSQL)
5. Chạy app:
   ```bash
   npm run dev
   # hoặc pnpm dev
   ```
6. Chạy smart contract (Hardhat):
   ```bash
   cd saga-contract
   npm install
   npx hardhat compile
   # Deploy contract lên PharmaDNA chainlet
   npx hardhat run scripts/deployPharmaNFT.ts --network pharmadna
   # Hoặc sử dụng script có sẵn (Windows)
   deploy-pharmadna.bat
   ```

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
- `npx hardhat run scripts/deployPharmaNFT.ts --network pharmadna` — Deploy contract
- `npx hardhat compile` — Compile contract

## Đóng góp & phát triển

- Fork, PR, issue đều welcome!
- Đọc kỹ code trong `app/api/` và `saga-contract/` để hiểu luồng nghiệp vụ.

---

Mọi thắc mắc vui lòng liên hệ admin dự án hoặc tạo issue trên repo!
