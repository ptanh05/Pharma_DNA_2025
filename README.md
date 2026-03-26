# Pharma DNA Saga 2025

Hệ thống truy xuất nguồn gốc thuốc trên blockchain Sui — đảm bảo tính minh bạch từ nhà sản xuất đến tay bệnh nhân.

## Tổng quan

- **Blockchain**: Sui Network (Testnet/Devnet)
- **Frontend**: Next.js 14 (App Router)
- **Database**: PostgreSQL
- **AI Agent**: OpenAI-powered automation
- **Styling**: Tailwind CSS + shadcn/ui

## Các vai trò

| Vai trò | Mô tả | Truy cập |
|---------|-------|----------|
| Manufacturer | Tạo lô thuốc, mint NFT, upload IPFS | `/manufacturer` |
| Distributor | Quản lý vận chuyển, chuyển đến nhà thuốc | `/distributor` |
| Pharmacy | Nhận hàng, quản lý tồn kho, xác minh | `/pharmacy` |
| Consumer | Tra cứu nguồn gốc sản phẩm qua QR code | `/lookup` |
| Admin | Quản lý hệ thống, cấp phát vai trò blockchain | `/admin` |

## Bắt đầu nhanh

```bash
# Cài đặt
npm install

# Development
npm run dev

# Production
npm run build
npm run start
```

## Cấu hình

Tạo file `.env.local` với các biến cần thiết:

```env
DATABASE_URL=postgresql://...
SUI_ADMIN_PRIVATE_KEY=0x...
NEXT_PUBLIC_PHARMA_NFT_PACKAGE_ID=0x...
NEXT_PUBLIC_SUI_RPC_URL=https://fullnode.devnet.sui.io:443
OPENAI_API_KEY=sk-...
```

## Cấu trúc thư mục

```
app/              # Next.js App Router (pages & API)
components/       # React components (UI & feature)
lib/              # Core services (blockchain, DB, AI agent, middleware)
hooks/            # Custom React hooks
sui-contract/    # Move smart contracts
```

## License

MIT
