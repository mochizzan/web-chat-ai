# 🚀 Professional Industry Transformation Plan: AI Chat Web (Ultra-Detailed)

## 📅 Document Info
- **Date:** 2026-05-17
- **Version:** 1.2.0 (Final Verification & Transactional Safety)
- **Status:** Ready for Execution
- **Objective:** Transform the project from a monolithic prototype to a professional, scalable, and maintainable Layered Architecture.

---

## 🏗️ 1. Architecture Overview: The Layered Approach

Kita akan mengimplementasikan **Service-Repository Pattern** dengan aliran dependensi satu arah:
`Route` $\rightarrow$ `Service` $\rightarrow$ `Repository` $\rightarrow$ `Database`

### 📐 Layer Definition & Constraints

#### 1. API Route Layer (The Entry Point)
- **Tanggung Jawab:** 
  - Parsing request body/params.
  - Validasi input menggunakan `zod` schema.
  - Pemanggilan fungsi Service.
  - Mapping hasil Service ke `apiSuccess` atau `apiError`.
- **Constraint:** ❌ DILARANG menulis query SQL. ❌ DILARANG menulis logika bisnis (if/else bisnis). ❌ DILARANG memanggil API eksternal secara langsung.

#### 2. Service Layer (The Brain/Orchestrator)
- **Tanggung Jawab:** 
  - Implementasi aturan bisnis (*Business Rules*).
  - Koordinasi antar Repository.
  - **Transaction Management:** Menggunakan `lib/db.ts` transaction untuk operasi atomik (misal: potong kredit + simpan log).
  - Integrasi API eksternal (OmniRouter).
- **Constraint:** ❌ DILARANG mengakses `NextRequest` atau `NextResponse`. ❌ DILARANG menulis query SQL mentah.

#### 3. Repository Layer (The Data Access)
- **Tanggung Jawab:** 
  - Abstraksi query SQL.
  - Mapping hasil database (snake_case) ke TypeScript Interface (camelCase).
  - Optimasi query (Indexing, Joins).
- **Constraint:** ❌ DILARANG mengandung logika bisnis. ❌ DILARANG memanggil Service lain.

#### 4. Notification/Infrastructure Layer (The Messenger)
- **Tanggung Jawab:** 
  - Abstraksi pengiriman pesan ke WebSocket server.
  - Manajemen konfigurasi environment (`WS_PORT`, `WS_KEY`).
- **Constraint:** Hanya digunakan oleh Service Layer.

---

## 📦 2. Domain Analysis & Detailed Mapping

### 🔐 Domain 1: Authentication & Session
**Current:** `api/auth/route.ts`, `api/auth/me/route.ts`, `lib/auth.ts`

| Logic | New Location | Detail Implementation |
| :--- | :--- | :--- |
| Token Generation/Verify | `services/auth.service.ts` | `generateToken()`, `verifyToken()` menggunakan `jsonwebtoken`. |
| User Lookup by Email | `repositories/user.repo.ts` | `findByEmail(email: string): Promise<User \| null>` |
| User Creation | `repositories/user.repo.ts` | `create(data: CreateUserDto): Promise<User>` |
| Password Hashing | `services/auth.service.ts` | `hashPassword()`, `comparePassword()` menggunakan `bcryptjs`. |
| Session Validation | `services/auth.service.ts` | `validateSession(token: string): Promise<AuthUser>` |

### 💬 Domain 2: Chat & Conversations
**Current:** `api/chat/route.ts`, `api/conversations/route.ts`, `api/conversations/[id]/route.ts`, `app/page.tsx`

| Logic | New Location | Detail Implementation |
| :--- | :--- | :--- |
| System Prompts | `config/prompts.ts` | Export `CATEGORY_PROMPTS` sebagai constant record. |
| Cost/Token Utils | `lib/utils/token.ts` | `calculateCost()`, `estimateTokens()` sebagai pure functions. |
| LLM Integration | `services/chat.service.ts` | `streamResponse()`: handle fetch ke OmniRouter & SSE parsing. |
| Conversation CRUD | `repositories/chat.repo.ts` | `createConversation()`, `getConversations(userId)`, `deleteConversation(id)`. |
| Message Persistence | `repositories/chat.repo.ts` | `saveMessage(msg: MessageDto)`, `getMessages(convId)`. |
| SSE Frontend Logic | `hooks/useChatStream.ts` | Buffer management, `appendStreamingContent`, `finalizeMessage`. |
| Code Block Parsing | `hooks/useChatCode.ts` | Regex parsing dari AI response $\rightarrow$ update Zustand store. |

### 💰 Domain 3: Billing & Credit System
**Current:** `api/topup/route.ts`, `api/usage/route.ts`, `api/account/route.ts`

| Logic | New Location | Detail Implementation |
| :--- | :--- | :--- |
| Credit Update | `repositories/billing.repo.ts` | `updateUserCredit(userId, amount)`, `updateTotalSpent(userId, amount)`. |
| Credit Log Entry | `repositories/billing.repo.ts` | `createCreditLog(log: CreditLogDto)`. |
| Usage Logging | `repositories/billing.repo.ts` | `saveUsageLog(log: UsageLogDto)`, `getUsageLogs(userId, limit)`. |
| Credit Validation | `services/billing.service.ts` | `checkSufficientCredit(userId, estimatedCost): Promise<boolean>`. |
| Topup Workflow | `services/billing.service.ts` | `processTopup()`: Update balance $\rightarrow$ Log $\rightarrow$ Broadcast WS. |

### 📊 Domain 4: Admin & Analytics
**Current:** `api/admin/users/route.ts`, `api/admin/analytics/route.ts`, `api/admin/logs/route.ts`

| Logic | New Location | Detail Implementation |
| :--- | :--- | :--- |
| User Management | `repositories/user.repo.ts` | `listUsers(page, limit, search)`, `updateUser(id, data)`. |
| Complex Analytics | `repositories/analytics.repo.ts` | Query agregasi untuk revenue, profit, active users, usage over time. |
| Analytics Logic | `services/analytics.service.ts` | `getDashboardStats(period, granularity)`: mapping raw SQL $\rightarrow$ Chart data. |
| Usage Log Audit | `repositories/billing.repo.ts` | `getAdminUsageLogs(page, limit, search, period)`. |

### 🤖 Domain 5: Model Management
**Current:** `api/models/route.ts`, `api/admin/sync-models/route.ts`

| Logic | New Location | Detail Implementation |
| :--- | :--- | :--- |
| Model CRUD | `repositories/model.repo.ts` | `getActiveModels()`, `updateModel(id, data)`, `deleteModel(id)`. |
| OmniRouter Sync | `services/model.service.ts` | `syncModelsFromRemote()`: Fetch remote $\rightarrow$ Diff with DB $\rightarrow$ Update/Insert. |
| Model Validation | `services/model.service.ts` | `validateModelStatus(modelId)`: check if 'active'. |

### 📢 Domain 6: Infrastructure (Cross-Cutting)
**Current:** Inline `fetch(WS_PORT/broadcast)` in multiple routes.

| Logic | New Location | Detail Implementation |
| :--- | :--- | :--- |
| WS Broadcast | `services/notification.service.ts` | `broadcast(event: WSEvent)`: Centralized fetch to WS server. |

---

## 🛠️ 3. Detailed Implementation Sequence

### Fase 1: Infrastructure & Base Layer
1. **Folder Setup:**
   - `src/repositories/`, `src/services/`, `src/config/`, `src/types/`, `src/lib/utils/`.
2. **Global Types (`src/types/index.ts`):**
   - Define `User`, `Conversation`, `Message`, `Model`, `CreditLog`, `UsageLog`, `AnalyticsSummary`.
3. **Standardized Response:**
   - Audit `src/lib/api-response.ts` untuk memastikan konsistensi `apiSuccess` dan `apiError`.

### Fase 2: Repository Layer (The Hands)
*Tujuan: Menghapus semua SQL dari Route.*
1. **`UserRepository`**: `findById`, `findByEmail`, `create`, `updateCredit`, `updateRole`, `listUsers`.
2. **`ChatRepository`**: `createConversation`, `getConversationsByUserId`, `saveMessage`, `getMessagesByConvId`, `deleteConversation`.
3. **`BillingRepository`**: `saveCreditLog`, `getUsageLogs`, `updateTotalSpent`, `updateUserCredit`.
4. **`ModelRepository`**: `getActiveModels`, `updateModelPricing`, `updateModelStatus`, `syncModels`.
5. **`AnalyticsRepository`**: `getRevenueStats`, `getUsageOverTime`, `getTopUsers`, `getNewUsersStats`.

### Fase 3: Service Layer (The Brain)
*Tujuan: Memindahkan logika bisnis dari Route.*
1. **`NotificationService`**: Implementasi `broadcast(event)`.
2. **`AuthService`**: Logika login, register, session verify.
3. **`BillingService`**: Logika kalkulasi biaya, pengecekan saldo, proses topup.
4. **`ChatService`**: Orchestrasi streaming LLM, integrasi web search, penyimpanan history.
5. **`ModelService`**: Logika sinkronisasi OmniRouter, validasi status model.
6. **`AnalyticsService`**: Mapping data mentah repository ke format chart frontend.
7. **`AdminService`**: Koordinasi manajemen user dan broadcast.

### Fase 4: API Route Refactoring (Thinning)
*Tujuan: Mengubah Route menjadi "Thin Layer".*
1. **Auth:** `api/auth/*` $\rightarrow$ `AuthService`.
2. **Chat:** `api/chat/*` $\rightarrow$ `ChatService`.
3. **Conversations:** `api/conversations/*` $\rightarrow$ `ChatService` / `ChatRepository`.
4. **Billing:** `api/account/*`, `api/topup/*`, `api/usage/*` $\rightarrow$ `BillingService`.
5. **Admin:** `api/admin/*` $\rightarrow$ `AdminService` / `AnalyticsService`.
6. **Models:** `api/models/*` $\rightarrow$ `ModelService`.

### Fase 5: Frontend Logic Extraction (Hooks)
*Tujuan: Membersihkan `page.tsx` dari logika berat.*
1. **`useChatStream`**: Pindahkan `processSSEStream` dan `handleSend`.
2. **`useChatActions`**: Pindahkan `handleRegenerate`, `handleDeleteConversation`, `handleEditConfirm`.
3. **`useAuthSession`**: Pindahkan `initializeSession` dan fetch data awal.
4. **`useAdminAnalytics`**: Hook khusus untuk fetch dan format data dashboard admin.

### Fase 6: Component Decomposition (UI)
*Tujuan: Memecah God Components menjadi reusable components.*
1. **`ChatContainer`**: Wrapper logika chat.
2. **`MessageBubble`**: Render pesan (User vs Assistant).
3. **`StreamingIndicator`**: Status "AI is thinking/searching".
4. **`ConversationList`**: Sidebar percakapan.
5. **`AdminUserTable`**: Tabel manajemen user dengan pagination.
6. **`AnalyticsChart`**: Wrapper untuk Recharts.

### Fase 7: Store Slimming
*Tujuan: Menjadikan Store sebagai "Pure State".*
1. Hapus fungsi asinkronus (`loginUser`, `registerUser`, `initializeSession`) dari `store.ts`.
2. Pindahkan fungsi tersebut ke `AuthService` $\rightarrow$ panggil via `useAuthSession` hook.
3. Split `useChatStore` menjadi `useUIStore` (sidebar, dialogs) dan `useChatDataStore` (messages, conversations).

---

## 🧪 4. Testing & Verification Strategy

1. **API Contract Test:** Memastikan response JSON tetap identik (field name & type).
2. **State Flow Verification:** Memastikan Zustand terupdate benar setelah migrasi ke hooks.
3. **Edge Case Testing:**
   - Topup jumlah negatif.
   - Chat dengan kredit 0.
   - Token expired saat streaming.
   - Delete conversation yang sedang aktif.
4. **Performance Check:** Cek memory leak pada SSE stream di custom hook.

---

## ⚠️ 5. Risk Mitigation

| Risk | Mitigation Strategy |
| :--- | :--- |
| **Breaking API Changes** | Gunakan versioning sementara jika perubahan drastis. |
| **State Desync** | Bersihkan storage `localStorage` saat migrasi schema store. |
| **Circular Dependency** | Aliran: `Route` $\rightarrow$ `Service` $\rightarrow$ `Repository`. Dilarang memanggil Service dari Repository. |
| **SSE Interruption** | Implementasikan `AbortController` secara konsisten di layer Hook. |

✅ **Plan saved to: plans/2026-05-17-professional-industry-transformation.md**
