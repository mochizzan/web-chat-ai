# Blueprint: Critical Security & Performance Fixes

**Date:** 2026-06-14
**Scope:** 5 critical/high severity fixes: SQL Injection, Credit Reservation Logic, Conversation Ownership, Missing Import Crash, Zustand Store Re-render Storm
**Priority:** P1–P3 (Critical → Architecture)

---

## A. SYSTEM OVERVIEW

### Problem
5 temuan dari audit komprehensif yang berdampak serius pada keamanan, logika bisnis, dan performa:

| # | Temuan | Severity | Kategori |
|---|--------|----------|----------|
| 1 | SQL Injection via string interpolation di `billing.repo.ts` | CRITICAL | Security |
| 2 | `refundCredit()` no‑op — credit tidak di‑deduct saat reserve, refund tidak bekerja | HIGH | Business Logic |
| 3 | Conversation GET/PATCH/DELETE tanpa ownership check — user B bisa akses data user A | HIGH | Security |
| 4 | `ChatRepository` tidak di‑import di `usage/route.ts` → runtime crash | HIGH | Bug |
| 5 | `useChatStore()` tanpa selector → re‑render storm pada setiap streaming chunk | HIGH | Performance |

### Goal
- Eliminasi semua vektor injection SQL
- Credit reservation menggunakan deduct‑then‑refund pattern yang benar
- Setiap conversation operation divalidasi ownership
- POST `/api/usage` tidak crash
- Semua consumer store menggunakan granular selectors – menghilangkan unnecessary re‑renders

---

## B. FILE MAPPING

| File | Action | Fix # | Changes |
|------|--------|-------|---------|
| `src/repositories/billing.repo.ts` | Modify | #1 | Parameterize LIMIT clause di `getUsageLogs()` dan `getCreditLogs()` |
| `src/services/api-gateway.service.ts` | Modify | #2 | `reserveCredit()` deduct langsung; `refundCredit()` mengembalikan credit; update semua caller |
| `src/app/api/conversations/[id]/route.ts` | Modify | #3 | Tambah ownership check pada GET, PATCH, DELETE |
| `src/app/api/usage/route.ts` | Modify | #4 | Tambah import `ChatRepository` |
| `src/lib/store.ts` | Modify | #5 | Perbaiki `useChatStore()` – useShallow & dev‑warning |
| `src/components/chat/chat-container.tsx` | Modify | #5 | Pecah ke individual selectors (useShallow) |
| `src/app/page.tsx` | Modify | #5 | Pindahkan inline functions ke `useCallback`, pecah selectors |
| `src/hooks/useChatActions.ts` | Modify | #5 | Ganti `useChatDataStore()` ke `getState()` dalam callbacks |
| `src/components/chat/message-list.tsx` | Modify | #5 | Ganti `useChatStore()` destructuring ke granular selectors |

---

## C. MODULE SPECIFICATIONS

### C1. Fix #1 — SQL Injection (`billing.repo.ts`)
**Masalah**: `LIMIT ${Number(limit)}` di‑interpolasi langsung ke string SQL.

**File:** `src/repositories/billing.repo.ts`

**Sebelum** (line 57 & 304):
```ts
const sql = `SELECT * FROM usage_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ${Number(limit)}`;
const sql = `SELECT * FROM credit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ${Number(limit)}`;
```
**Sesudah**:
```ts
const sql = `SELECT * FROM usage_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`;
const params = [userId, limit];

const sql = `SELECT * FROM credit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`;
const params = [userId, limit];
```
**Alasan:** MySQL `LIMIT ?` dengan prepared‑statement aman 100 %.

---

### C2. Fix #2 — Credit Reservation (`api-gateway.service.ts`)
**Masalah**: `reserveCredit()` hanya melakukan *check* (tidak deduct). `refundCredit()` hanya log (no‑op). Menyebabkan credit tidak berkurang dan race condition.

**File:** `src/services/api-gateway.service.ts`

#### Perubahan 1 – `reserveCredit()` (line 489‑515)
```ts
// BEFORE – hanya check
if (balance < minRequired) { throw new Error(...); }
return { reserved, creditBefore: balance };
```
**AFTER – deduct dalam transaction**
```ts
return await transaction(async conn => {
  await BillingRepository.lockUserForUpdate(userId, conn);
  const balance = await BillingRepository.getUserBalance(userId, conn);
  if (balance === null) throw new Error('INSUFFICIENT_CREDITS: User not found');
  const minRequired = reserved * 1.2;
  if (balance < minRequired) {
    throw new Error(`INSUFFICIENT_CREDITS: Kredit tidak cukup. Diperlukan minimal ${minRequired.toFixed(4)}, tersedia ${balance.toFixed(4)}`);
  }
  // deduct reserved amount atomically
  const deducted = await BillingRepository.deductUserCredit(userId, reserved, conn);
  if (!deducted) throw new Error('INSUFFICIENT_CREDITS: Kredit tidak cukup untuk reservasi');
  return { reserved, creditBefore: balance };
});
```
**Alasan:** Credit langsung dikurangi, menghilangkan race window.

#### Perubahan 2 – `refundCredit()` (line 521‑531)
```ts
async refundCredit(userId: string, amount: number, reason: string): Promise<void> {
  if (amount <= 0) return;
  try {
    await BillingRepository.updateUserCredit(userId, amount);
    console.log(`[API Gateway] Credit refunded: +${amount} for ${userId}: ${reason}`);
  } catch (err) {
    console.error('[API Gateway] Credit refund failed:', err);
  }
}
```
**Catatan:** Signature berubah – parameter kedua kini `amount` yang akan ditambahkan kembali.

#### Perubahan 3 – Update semua caller (`refundCredit` args)
- Line 251, 258, 267, 371, 380, 385: ganti `reservation.creditBefore` → `reservation.reserved`.
- **Contoh:**
```ts
await this.refundCredit(userId, reservation.reserved, 'OmniRouter connection failed');
```

#### Perubahan 4 – `handleNonStreaming()` (line 402‑412)
```ts
const finalCost = Math.min(actualCost, reservation.reserved);
const refundAmount = reservation.reserved - finalCost;
let creditAfter = reservation.creditBefore - finalCost;
if (refundAmount > 0) {
  try { await this.refundCredit(userId, refundAmount, `Reserved credit refund for ${body.model}`); }
  catch (e) { console.error('[API Gateway] Reserved credit refund failed:', e); }
}
```
**Alasan:** Credit sudah di‑deduct saat reserve, jadi cukup refund selisih.

#### Perubahan 5 – `analyzeStreamInBackground()` (line 621‑631)
```ts
const finalCost = Math.min(actualCost, reservation.reserved);
const refundAmount = reservation.reserved - finalCost;
if (refundAmount > 0) {
  try { await this.refundCredit(userId, refundAmount, `Reserved credit refund for ${model}`); }
  catch (e) { console.error('[API Gateway] Background credit refund failed:', e); }
}
```

#### Perubahan 6 – Error path dalam `analyzeStreamInBackground()` (line 677‑700)
```ts
await this.refundCredit(userId, reservation.reserved, `Error during streaming: ${err.message}`);
```
Lalu log usage dengan `credit_before` dan `credit_after` tetap `reservation.creditBefore`.

---

### C3. Fix #3 — Conversation Ownership (`conversations/[id]/route.ts`)
**Masalah**: API tidak memeriksa `user_id`.

**File:** `src/app/api/conversations/[id]/route.ts`

#### GET (line 6‑29)
```ts
if (data.conversation?.user_id !== auth.userId && auth.role !== 'admin') {
  return apiError('Forbidden: You do not have access to this conversation', 403, 'FORBIDDEN');
}
```
#### PATCH (line 31‑56)
```ts
const data = await ChatPersistenceService.getConversationDetails(id);
if (!data) return apiError('Conversation not found', 404, 'NOT_FOUND');
if (data.conversation?.user_id !== auth.userId && auth.role !== 'admin') {
  return apiError('Forbidden: You do not have access to this conversation', 403, 'FORBIDDEN');
}
```
#### DELETE (line 58‑76)
```ts
const data = await ChatPersistenceService.getConversationDetails(id);
if (!data) return apiError('Conversation not found', 404, 'NOT_FOUND');
if (data.conversation?.user_id !== auth.userId && auth.role !== 'admin') {
  return apiError('Forbidden: You do not have access to this conversation', 403, 'FORBIDDEN');
}
```
**Catatan:** `ChatPersistenceService.getConversationDetails()` sudah mengembalikan objek dengan properti `conversation.user_id`.

---

### C4. Fix #4 — Missing Import (`usage/route.ts`)
**Masalah**: `ChatRepository.saveUsageLog()` dipanggil tanpa import.

**File:** `src/app/api/usage/route.ts`

**SEBELUM (header):**
```ts
import { BillingService } from '@/services/billing.service';
import { ApiUsageRepository } from '@/repositories/api-usage.repo';
```
**SESUDAH (header):**
```ts
import { BillingService } from '@/services/billing.service';
import { ApiUsageRepository } from '@/repositories/api-usage.repo';
import { ChatRepository } from '@/repositories/chat.repo';
```
Sekarang `ChatRepository.saveUsageLog()` ter‑resolve.

---

### C5. Fix #5 — Zustand Store Re‑render Storm
#### Sub‑fix 5a – `src/lib/store.ts`
```ts
import { useShallow } from 'zustand/react/shallow';
export function useChatStore(): ChatState;
export function useChatStore<T>(selector: (state: ChatState) => T): T;
export function useChatStore<T>(selector?: (state: ChatState) => T): ChatState | T {
  if (!selector) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[useChatStore] Called without selector – may cause excessive re‑renders. Use granular selectors.');
    }
    const ui = useUIStore();
    const chat = useChatDataStore();
    return { ...ui, ...chat } as ChatState;
  }
  const uiSel = useUIStore(useShallow(state => selector(state as any) as any));
  const chatSel = useChatDataStore(useShallow(state => selector(state as any) as any));
  const ui = useUIStore();
  const chat = useChatDataStore();
  const merged: ChatState = { ...ui, ...chat };
  return selector(merged);
}
```
*Dev‑warning membantu developer menemukan pemanggilan yang masih berpotensi bermasalah.*

#### Sub‑fix 5b – `src/components/chat/chat-container.tsx`
```tsx
// UI selectors
const { isGenerating, sidebarOpen, editingMessageId, setEditingMessageId, toggleSidebar, setIsGenerating, clearStreaming } =
  useUIStore(useShallow(s => ({
    isGenerating: s.isGenerating,
    sidebarOpen: s.sidebarOpen,
    editingMessageId: s.editingMessageId,
    setEditingMessageId: s.setEditingMessageId,
    toggleSidebar: s.toggleSidebar,
    setIsGenerating: s.setIsGenerating,
    clearStreaming: s.clearStreaming,
  })));

// Data selectors
const { activeConversationId, activeCategory, messages, setActiveConversationId, setActiveCategory, resetChat, setMessages } =
  useChatDataStore(useShallow(s => ({
    activeConversationId: s.activeConversationId,
    activeCategory: s.activeCategory,
    messages: s.messages,
    setActiveConversationId: s.setActiveConversationId,
    setActiveCategory: s.setActiveCategory,
    resetChat: s.resetChat,
    setMessages: s.setMessages,
  })));

const containerState = {
  activeConversationId,
  activeCategory,
  messages,
  isGenerating,
  sidebarOpen,
  setActiveConversationId,
  setActiveCategory,
  toggleSidebar,
  resetChat,
  setMessages,
  editingMessageId,
  setEditingMessageId,
};
```
*useShallow* menjamin re‑render hanya bila properti yang dipilih berubah.

#### Sub‑fix 5c – `src/app/page.tsx`
```tsx
// selectors
const resetChat = useChatDataStore(s => s.resetChat);
const setActiveCategory = useChatDataStore(s => s.setActiveCategory);
const sidebarOpen = useUIStore(s => s.sidebarOpen);
const toggleSidebar = useUIStore(s => s.toggleSidebar);

// stable handlers (outside render‑prop)
const updatedHandleNewChat = useCallback(() => {
  resetChat();
  setMobileSidebarOpen(false);
}, [resetChat]);

const updatedHandleSelectConversation = useCallback(async (id: string) => {
  setMobileSidebarOpen(false);
  if (isLoadingMessages) return;
  setIsLoadingMessages(true);
  try { await handleLoadConversation(id); } finally { setIsLoadingMessages(false); }
}, [handleLoadConversation, isLoadingMessages]);

const updatedHandleQuickAction = useCallback((prompt: string, category: string) => {
  setActiveCategory(category);
  setInputPrompt(prompt);
  setInputKey(k => k + 1);
}, [setActiveCategory]);
```
Render‑prop kini hanya menerima `state => …` dengan **messages** & **isGenerating**; semua fungsi stabil tidak lagi dibuat tiap render.

#### Sub‑fix 5d – `src/hooks/useChatActions.ts`
```ts
export function useChatActions(handleSend: (msg: string) => void) {
  const { toast } = useToast();
  const removeConversation = useChatStore(s => s.removeConversation);

  // use getState() inside callbacks – no subscription
  const credit = useChatDataStore.getState().credit;
  const creditLogs = useChatDataStore.getState().creditLogs;
  const setCredit = useChatDataStore.getState().setCredit;
  const setTotalSpent = useChatDataStore.getState().setTotalSpent;
  const setCreditLogs = useChatDataStore.getState().setCreditLogs;
  // ... (deductCredit, addCredit, addUsageLog, addCreditLog) use these refs
}
```
Semua `useCallback` kini tergantung hanya pada `toast` dan `handleSend`.

#### Sub‑fix 5e – `src/components/chat/message-list.tsx`
```tsx
// UI selectors
const { isGenerating, setIsGenerating, clearStreaming } =
  useUIStore(useShallow(s => ({
    isGenerating: s.isGenerating,
    setIsGenerating: s.setIsGenerating,
    clearStreaming: s.clearStreaming,
  })));

// Data selectors
const { messages, streamingContent, streamingThinkingContent, isThinkingStreaming, isWebSearching } =
  useChatDataStore(useShallow(s => ({
    messages: s.messages,
    streamingContent: s.streamingContent,
    streamingThinkingContent: s.streamingThinkingContent,
    isThinkingStreaming: s.isThinkingStreaming,
    isWebSearching: s.isWebSearching,
  })));
```
Sekarang `MessageList` hanya re‑render bila ada perubahan pada salah satu dari field di atas.

---

## D. DATA FLOW & ERROR HANDLING

### Credit Flow (setelah fix #2)
```
User → reserveCredit() (transaction: lock + deduct reserved) →
   → Stream starts (credit already reduced) →
   → On success: actualCost ≤ reserved → refund (reserved‑actualCost) →
   → On error: full refund (reserved) →
   → UI receives `done` event dengan creditRemaining yang tepat
```
### Conversation Ownership
```
GET / PATCH / DELETE → verifyAuth() → getConversationDetails() →
   if conversation.user_id !== auth.userId && auth.role !== 'admin' → 403
   else → proceed
```
### Store Rendering (setelah fix #5)
```
appendStreamingContent() → UI‑store update (only UI slice) →
   useChatStore selectors NOT triggered (no merged object) →
   only components that select streamingContent re‑render (StreamingBubble, MessageList scroll)
```
---

## E. EXECUTION SEQUENCE
1. **Fix #1** – `billing.repo.ts` (SQL injection). Run unit tests targeting `BillingRepository`.
2. **Fix #4** – Add import to `usage/route.ts`. Run route integration test.
3. **Fix #2** – Credit reservation & refund logic (multiple files). Run end‑to‑end chat flow tests & credit balance unit tests.
4. **Fix #3** – Ownership checks on conversation API. Run auth‑based API tests.
5. **Fix #5** – Store refactor (store.ts, chat‑container, page, useChatActions, message‑list). Run React Profiler test suite & existing UI snapshot tests.
6. **Final validation** – `pnpm lint`, `pnpm test`, manual QA (streaming, credit, ownership, anonymous flow).

---

## F. RISKS & MITIGATIONS
| Risiko | Probabilitas | Dampak | Mitigasi |
|--------|--------------|--------|----------|
| Reserve deduct cause credit loss if process crashes before refund | Low | Medium | Credit‑refund runs in error‑catch; background job can reconcile nightly. |
| Caller miss update `reservation.reserved` → still refund wrong amount | Low | High | TypeScript enforces new signature; all 6 call sites patched. |
| Ownership check adds extra DB query per PATCH/DELETE | Low | Low | Query is a PK lookup; negligible performance impact. |
| useShallow not understood by team | Medium | Low | Added dev‑warning in `useChatStore`; docs updated. |
| Missing import cause runtime crash if new route added later | Low | High | Linter rule `no-unresolved-import` already active. |

---

## G. TESTING CHECKLIST
- [ ] `pnpm test` – semua existing tests pass.
- [ ] `pnpm lint` – tidak ada lint error baru.
- [ ] **Unit**: `BillingRepository.getUsageLogs` & `getCreditLogs` dengan limit param.
- [ ] **Integration**: POST `/api/usage` → tidak crash, credit log tersimpan.
- [ ] **E2E**: BYOK streaming dengan credit sufficient → credit berkurang tepat; dengan error → credit kembali penuh.
- [ ] **E2E**: User A tries GET `/api/conversations/{id}` milik User B → 403.
- [ ] **Performance**: React Profiler – verify `MessageList` tidak re‑render seluruh list pada tiap streaming chunk.
- [ ] **Manual**: Open multiple tabs, send chat simultaneously → second request blocked when credit insufficient.
- [ ] **Manual**: Admin user accesses any conversation → 200.

---

**End of plan**