# 🚀 PHARMA DNA 2025 - Production Setup

## 📋 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Git

### Installation

```bash
# 1. Clone & Install
git clone <repo>
cd Pharma_DNA_saga_2025
npm install

# 2. Setup Database
createdb pharma_dna

# 3. Configure Environment
cp env-example.txt .env.local
# Edit .env.local with your values

# 4. Initialize DB
npm run migrate

# 5. Start Development
npm run dev

# 6. Visit http://localhost:3000
```

---

## 🔧 Environment Variables

### Required
```env
DATABASE_URL=postgresql://user:password@localhost:5432/pharma_dna
SUI_ADMIN_PRIVATE_KEY=0x...
OPENAI_API_KEY=sk-...
ADMIN_PASSWORD=secure_password
```

### Optional
```env
PINATA_API_KEY=...
LOG_LEVEL=info
CACHE_ENABLED=true
```

---

## 🎯 Key Features

| Feature | Status | API Endpoint |
|---------|--------|--------------|
| **Admin Dashboard** | ✅ | `/admin` |
| **Manufacturer** | ✅ | `/manufacturer` |
| **Distributor** | ✅ | `/distributor` |
| **Pharmacy** | ✅ | `/pharmacy` |
| **Public Lookup** | ✅ | `/lookup` |
| **AI Agent** | ✅ | `/api/ai-agent/*` |
| **Blockchain** | ✅ | Sui Network |

---

## 📊 API Reference

### Admin Endpoints
```bash
GET /api/admin              # Dashboard stats
GET /api/admin/users        # List all users
POST /api/admin             # Assign role
DELETE /api/admin           # Remove user role

GET /api/admin/stats        # Detailed statistics
```

### Manufacturer
```bash
GET /api/manufacturer/nfts  # List my NFTs
POST /api/manufacturer/mint # Create NFT
```

### Public
```bash
GET /api/lookup             # Verify NFT by batch number
GET /api/public/verify      # Public verification
```

---

## 🚀 Production Deployment

### Using Vercel
```bash
npm run build
vercel deploy --prod
```

### Using Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm ci --only=production
RUN npm run build
CMD ["npm", "start"]
```

```bash
docker build -t pharma-dna .
docker run -p 3000:3000 pharma-dna
```

### Using PM2
```bash
npm install -g pm2
npm run build
pm2 start npm --name "pharma-dna" -- start
pm2 save
pm2 startup
```

---

## 🔐 Security Checklist

- [ ] Change `ADMIN_PASSWORD` from default
- [ ] Use strong `JWT_SECRET`
- [ ] Enable HTTPS in production
- [ ] Set `NODE_ENV=production`
- [ ] Limit rate limiting in production
- [ ] Rotate `SUI_ADMIN_PRIVATE_KEY` periodically
- [ ] Backup database daily
- [ ] Enable audit logging
- [ ] Use environment secrets management

---

## 📈 Monitoring

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Metrics
```bash
curl http://localhost:3000/api/metrics
```

### Performance
```bash
curl http://localhost:3000/api/performance/metrics
```

---

## 🛠️ Troubleshooting

### Error: `Database connection failed`
```bash
# Check PostgreSQL is running
psql -U postgres -h localhost

# Check DATABASE_URL in .env.local
```

### Error: `column "id" does not exist`
```bash
# Run migrations
npm run migrate
```

### Error: `OPENAI_API_KEY not found`
```bash
# Add to .env.local
OPENAI_API_KEY=sk-your-key
```

---

## 📝 Development Workflow

### File Structure
```
app/
  ├── admin/           # Admin dashboard page
  ├── api/             # API routes
  │   ├── admin/       # Admin endpoints
  │   ├── manufacturer/
  │   ├── distributor/
  │   ├── pharmacy/
  │   └── ai-agent/    # AI endpoints
  ├── lookup/          # Public lookup page
  └── manufacturer/    # Manufacturer page
lib/
  ├── db/              # Database logic
  ├── services/        # Business logic
  ├── blockchain/      # Sui integration
  └── utils/           # Utilities
```

### Adding New API Endpoint

1. Create route file: `app/api/path/route.ts`
2. Implement GET/POST handler
3. Add error handling
4. Test with curl

```typescript
export async function GET(req: NextRequest) {
  try {
    const data = await someService.getData();
    return NextResponse.json(data);
  }catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
```

---

## 🎓 Learning Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Sui Documentation](https://docs.sui.io)
- [PostgreSQL Guide](https://www.postgresql.org/docs)
- [React Best Practices](https://react.dev)

---

## 📞 Support & Contact

For issues:
1. Check logs in `logs/` directory
2. Review error messages
3. Check GitHub issues
4. Contact development team

---

## 📄 License

MIT License - See LICENSE file

---

**Last Updated**: February 2026
**Version**: 0.1.0
**Status**: Production Ready ✅
