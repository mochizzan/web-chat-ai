# Plan Perbaikan Bug: Recent Chat Tidak Tampil Saat Diklik di Sidebar

**Tanggal:** 2026-05-21  
**Severity:** Critical — Fitur utama tidak berfungsi  
**Komponen Terpengaruh:** `src/hooks/useChatActions.ts`, `src/hooks/__tests__/useChatActions.test.tsx`

---

## 1. Ringkasan Masalah

Ketika pengguna mengklik salah satu item conversation di sidebar (recent chat), kolom chat di halaman utama tetap kosong — tidak ada pesan yang muncul. Fitur load conversation secara visual tidak merespons sama sekali.

---

## 2. Analisis Root Cause

### 2.1 Alur Data Normal (Expected)

```
User klik sidebar item
  → Sidebar.handleConversationClick(id)
  → props.onSelectConversation(id)         [sidebar.tsx]
  → updatedHandleSelectConversation(id)    [page.tsx:87]
  → handleLoadConversation(id)             [useChatActions.ts:36]
  → fetch GET /api/conversations/{id}
  → API mengembalikan { success: true, data: { conversation, messages } }
  → setMessages(messages)                  [store.ts]
  → setActiveConversationId(id)            [store.ts]
  → React re-render → MessageList tampil
```

### 2.2 Alur Data Aktual (Buggy)

```
User klik sidebar item
  → ... (sama sampai fetch)
  → fetch GET /api/conversations/{id}
  → API mengembalikan { success: true, data: { conversation, messages } }
  → data = await res.json()
      data = { success: true, data: { conversation: {...}, messages: [...] } }
  → data.messages === undefined  ← BUG #1: tidak di-unwrap!
  → setMessages() TIDAK DIPANGGIL
  → setActiveConversationId() TIDAK DIPANGGIL  ← BUG #2
  → Store tidak berubah → MessageList tidak muncul ❌
```

---

## 3. Detail Bug yang Ditemukan

### Bug #1 — KRITIS: API Response Wrapper Tidak Di-unwrap

**File:** `src/hooks/useChatActions.ts` baris 36–56  
**Tipe:** Logic Error — salah akses struktur objek JSON

**Kode Bermasalah (saat ini):**
```typescript
const handleLoadConversation = useCallback(
  async (id: string) => {
    const { setMessages, setActiveCategory } = useChatStore.getState();
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages) {            // ← SELALU undefined/false!
          setMessages(data.messages);   // ← TIDAK PERNAH dipanggil
        }
        if (data.conversation?.category) {  // ← SELALU false!
          setActiveCategory(data.conversation.category);
        }
      }
    } catch (error) { ... }
  },
  []
);
```

**Penjelasan:**  
Fungsi `apiSuccess()` di `src/lib/api-response.ts:17` membungkus semua data dalam field `data`:
```json
{
  "success": true,
  "data": {
    "conversation": { "id": "...", "category": "chat", ... },
    "messages": [{ "id": "...", "role": "user", ... }]
  }
}
```

Kode di `handleLoadConversation` langsung mengakses `data.messages` dan `data.conversation`, padahal struktur aktualnya adalah `data.data.messages` dan `data.data.conversation`. Karena `data.messages` selalu `undefined`, kondisi `if (data.messages)` selalu `false`, sehingga `setMessages()` tidak pernah dipanggil.

**Referensi konsistensi:** Fungsi lain di file yang sama (`deductCredit`, `addCredit`) sudah melakukan unwrap dengan benar:
```typescript
// baris 165-166: contoh yang BENAR di file yang sama
const json = await response.json();
const data = json.data;  // ← unwrap dulu
```

---

### Bug #2 — MAYOR: `setActiveConversationId` Tidak Dipanggil

**File:** `src/hooks/useChatActions.ts` baris 36–56  
**Tipe:** Missing State Update

**Masalah:**  
Setelah messages berhasil di-load, `activeConversationId` di store tidak diupdate ke `id` conversation yang dipilih. Dampaknya:

1. **Sidebar tidak menyorot item aktif** — tidak ada visual feedback item mana yang sedang dibuka
2. **State tidak sinkron** — jika ada komponen yang bergantung pada `activeConversationId !== null` untuk conditional rendering
3. **Operasi selanjutnya (kirim pesan baru) bisa salah** — `useChatStream.ts` membaca `activeConversationId` untuk menentukan ke conversation mana pesan dikirim. Jika `null`, stream akan membuat conversation baru alih-alih lanjut di conversation yang dipilih

---

### Bug #3 — MINOR: Penggunaan `useChatStore.getState()` yang Tidak Konsisten

**File:** `src/hooks/useChatActions.ts` baris 38  
**Tipe:** Code Quality / Potential Stale Reference

**Masalah:**  
```typescript
const { setMessages, setActiveCategory } = useChatStore.getState();
```

`useChatStore.getState()` adalah fungsi **custom** (bukan Zustand native) yang menggabungkan dua store:
```typescript
// src/lib/store.ts:528
useChatStore.getState = (): ChatState => ({
  ...useUIStore.getState(),
  ...useChatDataStore.getState(),
});
```

Fungsi lain di file yang sama sudah menggunakan `useChatDataStore.getState()` langsung untuk akses setter data. Lebih aman dan eksplisit menggunakan `useChatDataStore.getState()` langsung karena:
- `setMessages` dan `setActiveConversationId` adalah milik `useChatDataStore`, bukan `useUIStore`
- Menghindari ketergantungan pada custom merger yang bisa berubah

---

## 4. Diagram Arsitektur — Sebelum vs Sesudah Fix

### Sebelum Fix
```
fetch /api/conversations/{id}
  └─ response: { success: true, data: { conversation, messages } }
       └─ data = await res.json()
            data = { success: true, data: {...} }
            data.messages = undefined ❌
            data.conversation = undefined ❌
            setMessages() tidak dipanggil ❌
            setActiveConversationId() tidak dipanggil ❌
```

### Sesudah Fix
```
fetch /api/conversations/{id}
  └─ response: { success: true, data: { conversation, messages } }
       └─ json = await res.json()
            payload = json.data
            payload.messages = [{ id, role, content, createdAt }] ✅
            payload.conversation = { id, category, ... } ✅
            setMessages(payload.messages) dipanggil ✅
            setActiveCategory(payload.conversation.category) dipanggil ✅
            setActiveConversationId(id) dipanggil ✅
```

---

## 5. Implementasi Fix

### 5.1 File Utama: `src/hooks/useChatActions.ts`

**Perubahan:**  
Ganti seluruh fungsi `handleLoadConversation` (baris 36–56):

```typescript
// SEBELUM (buggy):
const handleLoadConversation = useCallback(
  async (id: string) => {
    const { setMessages, setActiveCategory } = useChatStore.getState();
    try {
      console.log(`[${new Date().toISOString()}] [useChatActions] handleLoadConversation: Fetching conversation`, { id });
      const res = await fetch(`/api/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages) {
          setMessages(data.messages);
        }
        if (data.conversation?.category) {
          setActiveCategory(data.conversation.category);
        }
      }
    } catch (error) {
      console.log(`[${new Date().toISOString()}] [useChatActions] handleLoadConversation: Error`, { error });
    }
  },
  []
);
```

```typescript
// SESUDAH (fixed):
const handleLoadConversation = useCallback(
  async (id: string) => {
    const { setMessages, setActiveCategory, setActiveConversationId } =
      useChatDataStore.getState();  // Bug #3: gunakan useChatDataStore langsung
    try {
      console.log(`[${new Date().toISOString()}] [useChatActions] handleLoadConversation: Fetching conversation`, { id });
      const res = await fetch(`/api/conversations/${id}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data;  // Bug #1: unwrap dari { success, data: {...} }
        if (data?.messages) {
          setMessages(data.messages);
        }
        if (data?.conversation?.category) {
          setActiveCategory(data.conversation.category);
        }
        setActiveConversationId(id);  // Bug #2: update conversation aktif di store
      }
    } catch (error) {
      console.log(`[${new Date().toISOString()}] [useChatActions] handleLoadConversation: Error`, { error });
    }
  },
  []
);
```

**Catatan penting:**  
- Import `useChatDataStore` sudah ada di baris 4 file ini: `import { useChatStore, useChatDataStore } from '@/lib/store';`
- Tidak perlu menambahkan import baru

---

### 5.2 File Test: `src/hooks/__tests__/useChatActions.test.tsx`

**Perubahan 1:** Update mock response di test `'should load conversation and update store on success'` (baris 147–170)

Saat ini mock response tidak memiliki wrapper `{ success, data }` — perlu disesuaikan dengan struktur API aktual dan juga menambahkan ekspektasi `setActiveConversationId`.

```typescript
// SEBELUM (baris 152–158):
const mockResponse = {
  ok: true,
  json: jest.fn().mockResolvedValue({
    messages: mockMessages,
    conversation: { category: 'assistant' }
  })
};
```

```typescript
// SESUDAH:
const mockSetActiveConversationId = jest.fn(); // tambahkan di deskripsi describe (baris 27 area)

const mockResponse = {
  ok: true,
  json: jest.fn().mockResolvedValue({
    success: true,
    data: {                              // ← wrap dalam { success, data }
      messages: mockMessages,
      conversation: { category: 'assistant' }
    }
  })
};
```

**Perubahan 2:** Update mock `useChatDataStore.getState` agar menyertakan `setActiveConversationId` sebagai mock function yang bisa ditrack:

```typescript
// Di beforeEach atau di mockChatDataStore, pastikan:
(useChatDataStore as unknown as { getState: jest.Mock }).getState = jest.fn(() => ({
  ...mockChatDataStore,
  setActiveConversationId: mockSetActiveConversationId,
}));
```

**Perubahan 3:** Tambahkan ekspektasi baru di test success case:

```typescript
// Tambah assertion setelah baris 169:
expect(mockSetActiveConversationId).toHaveBeenCalledWith('conv-1');
```

**Perubahan 4:** Tambahkan test case baru untuk memastikan `setActiveConversationId` tidak dipanggil ketika API gagal:

```typescript
it('should not call setActiveConversationId on API error', async () => {
  const mockResponse = { ok: false };
  global.fetch = jest.fn().mockResolvedValue(mockResponse);

  const { result } = renderHook(() => useChatActions(jest.fn()));

  await act(async () => {
    await result.current.handleLoadConversation('conv-1');
  });

  expect(mockSetActiveConversationId).not.toHaveBeenCalled();
  expect(mockSetMessages).not.toHaveBeenCalled();
});
```

---

## 6. Verifikasi — Audit Endpoint Lain

Sebelum implementasi selesai, perlu memverifikasi apakah ada endpoint lain di `useChatActions.ts` atau hook lain yang punya masalah serupa (tidak meng-unwrap `json.data`).

**Hasil audit yang sudah dilakukan:**

| Fungsi | File | Status Unwrap |
|--------|------|---------------|
| `handleLoadConversation` | `useChatActions.ts:41` | ❌ **BUGGY** — `data.messages` langsung |
| `deductCredit` | `useChatActions.ts:165` | ✅ Benar — `const data = json.data` |
| `addCredit` | `useChatActions.ts:213` | ✅ Benar — `const data = json.data` |
| `addUsageLog` | `useChatActions.ts:248` | ✅ Tidak perlu data dari response |
| `addCreditLog` | `useChatActions.ts:281` | ✅ Tidak perlu data dari response |
| `handleDeleteConversation` | `useChatActions.ts:60` | ✅ Tidak butuh parse body |

**Kesimpulan:** Hanya `handleLoadConversation` yang memiliki masalah unwrap.

---

## 7. Urutan Implementasi

Implementasi harus dilakukan dalam urutan berikut untuk menghindari breaking change:

```
Step 1: Perbaiki src/hooks/useChatActions.ts
  └─ Ganti handleLoadConversation dengan versi fixed

Step 2: Update src/hooks/__tests__/useChatActions.test.tsx
  ├─ Update mock response struktur (tambah wrapper success/data)
  ├─ Tambahkan mockSetActiveConversationId di describe setup
  ├─ Update mockChatDataStore.getState untuk include setActiveConversationId
  ├─ Tambah assertion: setActiveConversationId dipanggil dengan id yang benar
  └─ Tambah test case: setActiveConversationId tidak dipanggil saat error

Step 3: Verifikasi manual di browser
  └─ Klik recent chat → messages muncul di area chat
  └─ Item yang diklik ter-highlight di sidebar
  └─ Kirim pesan baru → lanjut di conversation yang sama (bukan baru)
```

---

## 8. Risiko dan Mitigasi

| Risiko | Kemungkinan | Dampak | Mitigasi |
|--------|-------------|--------|----------|
| Unit test lain gagal akibat mock `useChatDataStore.getState` berubah | Rendah | Sedang | Jalankan seluruh suite test setelah perubahan |
| `setActiveConversationId` dipanggil tapi `useChatStream` membaca state lama (stale closure) | Sangat Rendah | Tinggi | `useChatStream` menggunakan `useChatStore.getState()` imperatif saat send, bukan React state |
| API `/api/conversations/{id}` berubah struktur response di masa depan | Rendah | Tinggi | Tambahkan TypeScript type guard untuk `data.data` |

---

## 9. Definisi Selesai (Definition of Done)

- [ ] `handleLoadConversation` menggunakan `json.data` untuk unwrap response
- [ ] `setActiveConversationId(id)` dipanggil setelah `setMessages` berhasil
- [ ] `useChatDataStore.getState()` digunakan sebagai pengganti `useChatStore.getState()` di `handleLoadConversation`
- [ ] Semua unit test di `useChatActions.test.tsx` lulus (tidak ada yang merah)
- [ ] Test baru untuk skenario error (setActiveConversationId tidak dipanggil) ditambahkan dan lulus
- [ ] Verifikasi manual: klik recent chat → pesan tampil di kolom chat
- [ ] Verifikasi manual: item conversation yang aktif ter-highlight di sidebar
- [ ] Verifikasi manual: kirim pesan baru setelah load conversation → pesan masuk ke conversation yang sama

---

## 10. File yang Diubah

| File | Jenis Perubahan | Jumlah Baris Berubah |
|------|-----------------|----------------------|
| `src/hooks/useChatActions.ts` | Fix bug (ganti implementasi `handleLoadConversation`) | ~10 baris |
| `src/hooks/__tests__/useChatActions.test.tsx` | Update test mock + tambah assertions + test case baru | ~25 baris |

**Total scope perubahan: minimal, terlokalisasi, tidak ada breaking change ke interface publik.**
