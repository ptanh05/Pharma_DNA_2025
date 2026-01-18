# 🚀 PharmaDNA Development Roadmap

## Phân tích hiện trạng dự án

### ✅ Đã hoàn thành
- Smart contract Sui Move với RBAC
- Database schema (PostgreSQL)
- API routes cơ bản (CRUD operations)
- Frontend pages cho các roles (Manufacturer, Distributor, Pharmacy, Admin)
- Wallet connection (Sui Wallet Kit)
- IPFS integration
- AI Agent system (LangChain)
- Client-side signing infrastructure (API routes + helper functions)

### ⚠️ Vấn đề cần giải quyết

---

## 📋 TODO LIST - Theo thứ tự ưu tiên

### 🔴 **PRIORITY 1: CRITICAL - Bảo mật & Core Functionality**

#### 1.1. Tích hợp Client-side Signing vào Frontend Components
**Mức độ:** 🔴 CRITICAL  
**Lý do:** 
- Hiện tại đang dùng server-side signing (private key trong env) → RỦI RO BẢO MẬT CAO
- User không kiểm soát được private key của mình
- Vi phạm nguyên tắc "Not your keys, not your crypto"

**Công việc:**
- [ ] Tích hợp `mintNFTWithWallet()` vào `app/manufacturer/page.tsx` (thay thế API call hiện tại)
- [ ] Tích hợp `transferNFTWithWallet()` vào `components/TransferToPharmacyForm.tsx`
- [ ] Tích hợp `transferNFTWithWallet()` vào `app/distributor/page.tsx` (khi approve transfer request)
- [ ] Thêm loading states và error handling khi user ký transaction
- [ ] Thêm confirmation dialogs trước khi ký
- [ ] Test với Sui wallet extension

**Files cần sửa:**
- `app/manufacturer/page.tsx` (dòng 247-305)
- `components/TransferToPharmacyForm.tsx` (thêm logic transfer)
- `app/distributor/page.tsx` (nếu có approve transfer)
- `app/api/distributor/transfer-to-pharmacy/route.ts` (có thể giữ server-side làm fallback)

**Ước tính:** 4-6 giờ

---

#### 1.2. Input Validation & Sanitization
**Mức độ:** 🔴 CRITICAL  
**Lý do:**
- Thiếu validation → SQL injection, XSS attacks
- User có thể nhập dữ liệu sai format → lỗi blockchain

**Công việc:**
- [ ] Thêm Zod schema validation cho tất cả API routes
- [ ] Validate Sui addresses format (regex: `^0x[a-fA-F0-9]{64}$`)
- [ ] Sanitize user inputs (HTML escape, SQL injection prevention)
- [ ] Validate file uploads (type, size limits)
- [ ] Validate dates (expiry > manufacturing date)

**Files cần sửa:**
- Tạo `lib/validation/schemas.ts`
- Update tất cả API routes (`app/api/**/route.ts`)
- Update frontend forms với react-hook-form + zod resolver

**Ước tính:** 3-4 giờ

---

#### 1.3. Error Handling & User Feedback
**Mức độ:** 🔴 CRITICAL  
**Lý do:**
- User không biết lỗi gì khi transaction fail
- Thiếu error boundaries → app crash
- Thiếu loading states → UX kém

**Công việc:**
- [ ] Thêm Toast notifications (dùng `sonner` đã có trong dependencies)
- [ ] Thêm Error Boundaries cho mỗi page
- [ ] Cải thiện error messages (user-friendly, không expose technical details)
- [ ] Thêm retry logic cho failed transactions
- [ ] Thêm loading skeletons thay vì spinner đơn giản

**Files cần tạo/sửa:**
- `components/ErrorBoundary.tsx` (mới)
- `components/ui/toast.tsx` (nếu chưa có)
- Update tất cả pages để dùng toast
- `lib/utils/error-handler.ts` (mới)

**Ước tính:** 3-4 giờ

---

### 🟠 **PRIORITY 2: HIGH - UX/UI Improvements**

#### 2.1. Real-time Updates với WebSocket
**Mức độ:** 🟠 HIGH  
**Lý do:**
- User phải refresh để thấy updates
- Transfer requests, milestones cần real-time notifications
- Đã có `socket.io` trong dependencies nhưng chưa dùng

**Công việc:**
- [ ] Setup Socket.io server (Next.js API route)
- [ ] Emit events khi có transfer request mới
- [ ] Emit events khi milestone được thêm
- [ ] Frontend subscribe để update UI real-time
- [ ] Thêm notification badge cho pending requests

**Files cần tạo/sửa:**
- `app/api/socket/route.ts` (mới)
- `lib/socket/client.ts` (mới)
- Update pages để subscribe events
- `components/NotificationBadge.tsx` (mới)

**Ước tính:** 4-5 giờ

---

#### 2.2. Pagination & Search/Filter
**Mức độ:** 🟠 HIGH  
**Lý do:**
- Danh sách NFT, transfer requests sẽ dài → performance kém
- User khó tìm NFT cụ thể

**Công việc:**
- [ ] Thêm pagination cho NFT lists
- [ ] Thêm search bar (tìm theo batch number, name)
- [ ] Thêm filters (status, date range, role)
- [ ] Thêm sorting (newest, oldest, status)

**Files cần sửa:**
- `app/manufacturer/page.tsx`
- `app/distributor/page.tsx`
- `app/pharmacy/page.tsx`
- API routes thêm query params (page, limit, search, filter)

**Ước tính:** 3-4 giờ

---

#### 2.3. Confirmation Dialogs & Better Empty States
**Mức độ:** 🟠 HIGH  
**Lý do:**
- User có thể click nhầm → mất tiền (gas fees)
- Empty states hiện tại chưa hướng dẫn user

**Công việc:**
- [ ] Thêm confirmation dialogs cho tất cả blockchain actions (mint, transfer)
- [ ] Hiển thị gas fee estimate trước khi confirm
- [ ] Cải thiện empty states (thêm illustrations, CTA buttons)
- [ ] Thêm onboarding tooltips cho first-time users

**Files cần sửa:**
- Tạo `components/ConfirmDialog.tsx` (mới)
- Update tất cả pages với empty states tốt hơn
- `components/OnboardingTooltip.tsx` (mới)

**Ước tính:** 2-3 giờ

---

### 🟡 **PRIORITY 3: MEDIUM - Performance & Code Quality**

#### 3.1. API Rate Limiting
**Mức độ:** 🟡 MEDIUM  
**Lý do:**
- Prevent abuse, DDoS attacks
- Fair usage cho tất cả users

**Công việc:**
- [ ] Setup rate limiting middleware (dùng `@upstash/ratelimit` hoặc tự implement)
- [ ] Rate limit theo IP address
- [ ] Rate limit theo wallet address (cho blockchain actions)
- [ ] Thêm headers `X-RateLimit-*` để frontend hiển thị

**Files cần tạo/sửa:**
- `lib/middleware/rate-limit.ts` (mới)
- Wrap API routes với rate limit middleware

**Ước tính:** 2-3 giờ

---

#### 3.2. Caching & Database Optimization
**Mức độ:** 🟡 MEDIUM  
**Lý do:**
- Giảm load database
- Faster response times

**Công việc:**
- [ ] Thêm Redis caching cho NFT metadata (IPFS data)
- [ ] Cache role checks (TTL: 5 phút)
- [ ] Optimize database queries (indexes, connection pooling)
- [ ] Thêm database indexes cho các columns thường query

**Files cần tạo/sửa:**
- `lib/cache/redis.ts` (mới)
- Update API routes để dùng cache
- Database migration scripts cho indexes

**Ước tính:** 3-4 giờ

---

#### 3.3. Code Refactoring & Type Safety
**Mức độ:** 🟡 MEDIUM  
**Lý do:**
- Code duplicate giữa pages
- Thiếu type safety → bugs khó phát hiện

**Công việc:**
- [ ] Tạo shared components cho NFT cards, transfer request cards
- [ ] Extract common logic vào custom hooks
- [ ] Thêm strict TypeScript types cho API responses
- [ ] Refactor duplicate code (role checking, wallet connection)

**Files cần tạo/sửa:**
- `components/NFTCard.tsx` (mới)
- `components/TransferRequestCard.tsx` (mới)
- `hooks/useNFTList.ts` (mới)
- `types/api.ts` (mới)

**Ước tính:** 4-5 giờ

---

### 🟢 **PRIORITY 4: LOW - Nice to Have**

#### 4.1. Analytics & Monitoring
**Mức độ:** 🟢 LOW  
**Lý do:**
- Track user behavior, errors
- Monitor system health

**Công việc:**
- [ ] Setup analytics (Google Analytics hoặc Plausible)
- [ ] Log errors to external service (Sentry)
- [ ] Dashboard để monitor transactions, API calls

**Ước tính:** 2-3 giờ

---

#### 4.2. Advanced Features
**Mức độ:** 🟢 LOW  
**Lý do:**
- Enhance user experience
- Competitive features

**Công việc:**
- [ ] Export data (CSV, PDF reports)
- [ ] Email notifications cho transfer requests
- [ ] QR code generation cho NFTs
- [ ] Batch operations (transfer multiple NFTs)
- [ ] NFT history timeline visualization

**Ước tính:** 5-8 giờ

---

## 📊 Tổng kết

### Thời gian ước tính:
- **Priority 1 (Critical):** 10-14 giờ
- **Priority 2 (High):** 9-12 giờ
- **Priority 3 (Medium):** 9-12 giờ
- **Priority 4 (Low):** 7-11 giờ

**Tổng:** ~35-49 giờ development

### Khuyến nghị:
1. **Bắt đầu với Priority 1** - Đây là những vấn đề ảnh hưởng trực tiếp đến bảo mật và trải nghiệm người dùng
2. **Sau đó Priority 2** - Cải thiện UX để user muốn quay lại sử dụng
3. **Priority 3 & 4** - Làm khi có thời gian, không ảnh hưởng core functionality

### Lưu ý:
- Test kỹ sau mỗi thay đổi
- Document các API changes
- Backup database trước khi deploy
- Monitor gas fees trên Sui testnet/mainnet

