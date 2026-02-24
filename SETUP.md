# 🚀 PHARMA DNA SETUP GUIDE

## ⚡ Quick Setup

### 1. Cài đặt Dependencies
```bash
npm install
```

### 2. Setup Database
```bash
# Cập nhật .env.local với DATABASE_URL
# Sau đó chạy migration
npm run migrate
```

### 3. Setup Environment Variables
Tạo file `.env.local` (copy từ `.env.production` hoặc `.env.development`)

```env
# CRITICAL: Phải có cấu hình này
DATABASE_URL=postgresql://user:password@localhost:5432/pharma_dna
SUI_ADMIN_PRIVATE_KEY=0x...your_private_key...
OPENAI_API_KEY=sk-...
```

### 4. Chạy Development Server
```bash
npm run dev
```

Access: http://localhost:3000

---

## 📋 Environment Variables Required

### Database
- `DATABASE_URL` - PostgreSQL connection string

### Blockchain (Sui)
- `SUI_RPC_URL` - Sui RPC endpoint
- `SUI_ADMIN_PRIVATE_KEY` - Admin wallet private key
- `SUI_PACKAGE_ID` - Deployed package ID
- `OWNER_ADDRESS` - Owner wallet address

### AI Agent
- `OPENAI_API_KEY` - OpenAI API key
- `OPENAI_MODEL` - Model name (default: gpt-3.5-turbo)

### Admin
- `ADMIN_PASSWORD` - Admin login password

---

## 🔐 Security Checklist

- [ ] Change `ADMIN_PASSWORD` before production
- [ ] Never commit `.env.local` to git
- [ ] Rotate `SUI_ADMIN_PRIVATE_KEY` regularly
- [ ] Keep `JWT_SECRET` strong and random
- [ ] Use HTTPS in production
- [ ] Enable rate limiting in production

---

## 🚀 Production Deployment

### Build
```bash
npm run build
```

### Run Production
```bash
npm run prod
```

### With PM2 (recommended)
```bash
pm2 start npm --name "pharma-dna" -- start
pm2 save
```

---

## 📊 Key Features

✅ **Blockchain**: Sui smart contracts for NFT tracking
✅ **Admin Panel**: Role-based access control
✅ **AI Agent**: Automated supply chain analytics
✅ **API**: RESTful endpoints for all operations
✅ **Real-time**: WebSocket for notifications

---

## 🆘 Troubleshooting

### Error: `column "id" does not exist`
Solution: Run `npm run migrate` to initialize database

### Error: `OPENAI_API_KEY not found`
Solution: Add `OPENAI_API_KEY` to `.env.local`

### Port 3000 already in use
Solution: `npm run dev -- -p 3001`

---

## 📝 API Documentation

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/health` | GET | - | Health check |
| `/api/admin` | GET/POST | ✅ | Admin dashboard |
| `/api/manufacturer/*` | GET/POST | ✅ | Manufacturer operations |
| `/api/distributor/*` | GET/POST | ✅ | Distributor operations |
| `/api/pharmacy/*` | GET/POST | ✅ | Pharmacy operations |
| `/api/lookup` | GET | - | Public NFT lookup |
| `/api/ai-agent/*` | GET/POST | ✅ | AI agent endpoints |

---

## 📞 Support

For issues or questions, check:
- Database logs: `logs/db.log`
- App logs: `logs/app.log`
- Terminal output during development
