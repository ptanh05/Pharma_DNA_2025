# 📚 PHARMA DNA SAGA 2025 - README

## 🎯 Giới thiệu dự án pharma

**Pharma DNA Saga 2025** là một hệ thống quản lý nguồn gốc thuốc (Pharmaceutical Supply Chain Tracking) sử dụng:
- **Blockchain Sui** để đảm bảo tính minh bạch
- **AI Agent** để tự động hóa quy trình
- **PostgreSQL** để lưu trữ dữ liệu
- **Next.js** cho frontend

---

## 🚀 Quick Start

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Cấu hình environment variables
```bash
cp .env.example .env.local
```

Cần thiết lập:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/pharma
BLOCKCHAIN_NETWORK=sui-testnet
OWNER_PRIVATE_KEY=0x...
OPENAI_API_KEY=sk-...
```

### 3. Chạy development server
```bash
npm run dev
```

Truy cập: http://localhost:3000

---

## 📋 Các vai trò chính

| Vai trò | Chức năng | URL |
|---------|----------|-----|
| 🏭 Manufacturer | Tạo NFT, upload IPFS | /manufacturer |
| 🚚 Distributor | Quản lý vận chuyển | /distributor |
| 💊 Pharmacy | Nhập kho, xác minh | /pharmacy |
| 🔍 Consumer | Tra cứu nguồn gốc | /lookup |
| 👨‍💼 Admin | Quản lý hệ thống | /admin |

---

## 🔌 API Endpoints

### Health Check
```bash
GET /api/health
```

### Admin Authentication
```bash
POST /api/auth/admin/login
POST /api/auth/admin/logout
```

### Manufacturer
```bash
GET /api/manufacturer
POST /api/manufacturer
PUT /api/manufacturer
DELETE /api/manufacturer
```

### Distributor
```bash
GET /api/distributor
PUT /api/distributor
```

### Pharmacy
```bash
GET /api/pharmacy
PUT /api/pharmacy
```

### Admin
```bash
GET /api/admin
POST /api/admin
```

---

## 🧪 Testing

### Chạy tất cả tests
```bash
npm test
```

### Chạy test cụ thể
```bash
npm test -- __tests__/api/manufacturer.test.ts
```

### Với coverage
```bash
npm test -- --coverage
```

---

## 📁 Cấu trúc thư mục

```
pharma-dna-saga-2025/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── manufacturer/      # Manufacturer page
│   ├── distributor/       # Distributor page
│   ├── pharmacy/          # Pharmacy page
│   ├── lookup/            # Public lookup
│   └── admin/             # Admin page
├── components/            # React components
├── lib/                   # Utilities & services
│   ├── auth/             # Authentication
│   ├── blockchain/       # Blockchain integration
│   ├── db/               # Database
│   ├── middleware/       # Middleware
│   ├── utils/            # Utilities
│   └── validation/       # Validation
├── hooks/                # React hooks
├── public/               # Static assets
├── __tests__/            # Tests
└── sui-contract/         # Move smart contracts
```

---

## 🔐 Security

### Input Validation
- Tất cả inputs được sanitize
- Zod schema validation
- SQL injection prevention

### Authentication
- Admin login/logout
- Token-based sessions
- Role-based access control

### Rate Limiting
- 100 requests/min cho read
- 30 requests/min cho write
- 50 requests/min cho admin

---

## 📊 Database Schema

### NFTs Table
```sql
CREATE TABLE nfts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  batch_number VARCHAR(100) UNIQUE,
  status VARCHAR(50),
  manufacturer_address VARCHAR(100),
  distributor_address VARCHAR(100),
  pharmacy_address VARCHAR(100),
  object_id VARCHAR(255),
  created_at TIMESTAMPTZ
);
```

### Users Table
```sql
CREATE TABLE users (
  address VARCHAR(100) PRIMARY KEY,
  role VARCHAR(50),
  assigned_at TIMESTAMPTZ
);
```

---

## 🛠️ Development

### Linting
```bash
npm run lint
```

### Build
```bash
npm run build
```

### Production
```bash
npm run start
```

---

## 📖 Documentation

- [TEST_AND_FIX_PLAN.md](./TEST_AND_FIX_PLAN.md) - Test plan
- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) - Implementation guide
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Testing guide
- [FIX_CHECKLIST.md](./FIX_CHECKLIST.md) - Fix checklist

---

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

---

## 📞 Support

Nếu gặp vấn đề:
1. Kiểm tra logs
2. Kiểm tra environment variables
3. Kiểm tra database connection
4. Kiểm tra blockchain connection

---

## 📄 License

MIT License

---

