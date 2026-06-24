# Pharma DNA Saga 2025

> He thống truy xuất nguồn gốc thuốc trên blockchain Sui — đảm bảo tính minh bạch từ nhà sản xuất đến tay bệnh nhân.

## Tổng quan

Pharma DNA là một nền tảng theo dõi chuỗi cung ứng dược phẩm, kết hợp:

- **Blockchain Sui** — Smart contract (Move) ghi nhận từng bước lưu thông thuốc, mint NFT cho mỗi lô sản xuất
- **Next.js 15 (App Router)** — Giao diện web cho tất cả vai trò trong chuỗi cung ứng
- **PostgreSQL + Redis** — Dữ liệu quan hệ và bộ nhớ đệm hiệu năng cao
- **AI Agent (LangChain + OpenAI)** — Tự động hóa tác vụ, giám sát và cảnh báo chất lượng
- **IPFS (Pinata)** — Lưu trữ metadata phi tập trung cho NFT
- **Sentry** — Theo dõi lỗi production
- **WebSocket / SSE** — Thông báo realtime

## Các vai trò

| Vai trò | Mô tả | Đường dẫn |
|---------|-------|-----------|
| **Manufacturer** | Tạo lô thuốc, mint NFT, upload metadata lên IPFS | `/manufacturer` |
| **Distributor** | Quản lý vận chuyển, chuyển hàng đến nhà thuốc | `/distributor` |
| **Pharmacy** | Nhận hàng, quản lý tồn kho, xác minh nguồn gốc | `/pharmacy` |
| **Consumer** | Tra cứu nguồn gốc sản phẩm qua QR code | `/lookup` |
| **Admin** | Quản lý hệ thống, cấp phát vai trò trên blockchain | `/admin` |

## Yêu cầu hệ thống

| Thành phần | Phiên bản |
|------------|-----------|
| Node.js | >= 20 |
| PostgreSQL | >= 15 (hoặc Docker) |
| Redis | >= 7 (hoặc Docker) |
| Sui CLI | >= 1.28 (cho phát triển contract) |
| npm | >= 10 |

## Cài đặt

### 1. Cài đặt dependencies

```bash
npm install
```

### 2. Cấu hình biến môi trường

Sao chép file mẫu và điền thông tin:

```bash
cp .env.example .env
```

Các biến bắt buộc:

```env
# Database
DATABASE_URL=postgres://pharma_dna_user:changeme@localhost:5432/pharma_dna

# Sui Blockchain
SUI_NETWORK=testnet
SUI_ADMIN_PRIVATE_KEY=0x...
SUI_PACKAGE_ID=0x...

# AI Agent
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
AI_AGENT_AUTO_EXECUTE_ONCHAIN=false

# JWT Authentication
JWT_SECRET=<tối thiểu 32 ký tự ngẫu nhiên>
ADMIN_JWT_SECRET=<tối thiểu 32 ký tự ngẫu nhiên>

# Pinata (IPFS)
PINATA_API_KEY=...
PINATA_SECRET_KEY=...

# Sentry (tùy chọn)
SENTRY_DSN=...
```

### 3. Khởi chạy database

**Cách 1 — Docker (khuyến nghị):**

```bash
docker-compose up -d postgres redis
```

**Cách 2 — Local PostgreSQL:**

```bash
npm run migrate
```

### 4. Chạy ứng dụng

```bash
# Development
npm run dev

# Production build
npm run build
npm run start
```

## Docker — Production

Build và chạy toàn bộ stack (PostgreSQL + Redis + App):

```bash
docker-compose up -d
```

Các lệnh hữu ích:

```bash
docker-compose logs -f app    # Xem log ứng dụng
docker-compose down           # Dừng toàn bộ
docker-compose down -v        # Dừng và xóa dữ liệu
```

## Smart Contract (Sui Move)

Contract nằm trong thư mục `sui-contract/`:

```
sui-contract/
  Move.toml          # Manifest
  sources/           # Mã nguồn Move
  tests/             # Unit tests
  Published.toml     # Thông tin deploy
  Move.lock          # Khóa dependencies
```

Deploy lên Sui Testnet:

```bash
./scripts/deploy-sui-contract.sh
```

## Testing

```bash
npm run test              # Unit tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
npm run test:integration  # Integration tests
```

## Cấu trúc thư mục

```
Pharma_DNA/
  app/                    # Next.js App Router (pages + API routes)
    admin/                # Trang quản trị
    manufacturer/         # Trang nhà sản xuất
    distributor/          # Trang nhà phân phối
    pharmacy/             # Trang nhà thuốc
    lookup/               # Tra cứu QR code
    register/             # Đăng ký tài khoản
    api/                  # API endpoints
  components/             # React components (UI + feature)
  lib/                    # Core services
    actions/              # Server actions
    ai-agent/             # LangChain AI agent
    auth/                 # JWT authentication
    blockchain/           # Sui blockchain integration
    cache/                # Redis caching
    db/                   # PostgreSQL repositories
    middleware/           # Route middleware
    notification/         # WebSocket + SSE notifications
    services/             # Business logic services
    security/             # Security utilities
    validation/           # Zod schemas
  hooks/                  # Custom React hooks
  sui-contract/           # Move smart contracts
  migrations/             # Database migrations
  scripts/                # Deployment & utility scripts
  public/                 # Static assets
  database/               # Database setup scripts
  logs/                   # Application logs (Winston)
```

## Kiến trúc hệ thống

```
  Client (Browser)
       |
  Next.js App (Next.js 15 App Router)
       |
  +---------+----------+----------+
  |         |          |          |
  DB     Redis      Sui       OpenAI
  (PG)   (Cache)   Network    (AI Agent)
                       |
                   IPFS (Pinata)
```

- **Authentication**: JWT tokens, phân quyền theo vai trò (Admin / Manufacturer / Distributor / Pharmacy / Consumer)
- **Blockchain**: Mỗi lô thuốc được mint dưới dạng NFT trên Sui, ghi nhận các bước chuyển giao
- **Caching**: Redis cache cho các truy vấn thường dùng
- **Realtime**: WebSocket + SSE cho thông báo và cập nhật trạng thái
- **Error tracking**: Sentry tích hợp client + server
- **Logging**: Winston ghi log ứng dụng

## License

MIT
