# Rencana: Injeksi Konteks Waktu Real-Time ke System Prompt AI

## 1. Ringkasan

Menambahkan informasi waktu real-time (jam, tanggal, hari, bulan, tahun, zona waktu) ke dalam system prompt yang dikirim ke LLM di route `/api/chat`. Zona waktu **berasal dari browser user** (bukan hardcode server).

---

## 2. Analisis Situasi Saat Ini

### 2.1. Letak Kode

File target: [`src/app/api/chat/route.ts`](src/app/api/chat/route.ts) (baris 6-101)

Prompt statis di baris 6-19 — tidak ada konteks waktu:
```
CATEGORY_PROMPTS.assistant = 'You are a helpful AI assistant...'
CATEGORY_PROMPTS.natural   = 'You are a natural conversation partner...'
...
```

System prompt dikirim apa adanya di baris 97-101 tanpa info waktu.

### 2.2. Frontend → API Request Flow

[`src/app/page.tsx:334-345`](src/app/page.tsx:334):

```typescript
body: JSON.stringify({
  message,
  model: activeModelRef.current,
  category: activeCategoryRef.current,
  history: conversationHistory,
  conversationId: activeConversationIdRef.current,
})
```

Tidak ada field `timezone`.

### 2.3. Yang SUDAAH Tersedia

- Server punya akses ke `new Date()` kapan saja
- Browser bisa mendeteksi timezone user via `Intl.DateTimeFormat().resolvedOptions().timeZone`

---

## 3. Arsitektur Solusi

### 3.1. Alur Data (Setelah)

```
Browser                          Server
  │                                │
  ├─ Deteksi timezone via ──────┐  │
  │  Intl.resolvedOptions()     │  │
  │                             │  │
  ├─ Kirim POST /api/chat ──────┤  │
  │  { message, timezone:       │  │
  │    "Asia/Jakarta" }         │  │
  │                             │  │
  │              ┌──────────────┘  │
  │              ▼                 │
  │         buildTimeContext(      │
  │           "Asia/Jakarta")      │
  │              │                 │
  │              ▼                 │
  │         systemPrompt +         │
  │         "Sekarang: Sabtu, ..." │
  │              │                 │
  │              ▼                 │
  │            LLM                 │
```

### 3.2. Perubahan di 2 File

| File | Perubahan |
|------|-----------|
| [`src/app/page.tsx`](src/app/page.tsx) | +1 baris: deteksi & kirim `timezone` |
| [`src/app/api/chat/route.ts`](src/app/api/chat/route.ts) | +14 baris: fungsi `buildTimeContext`, terima parameter `timezone` |

Tidak ada perubahan di database, UI, atau file lain.

---

## 4. Rencana Implementasi Detail

### Langkah 1: Frontend — Deteksi & Kirim Timezone

**File:** [`src/app/page.tsx`](src/app/page.tsx) — sekitar baris 337-345

Tambahkan deteksi timezone user di browser:

```typescript
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
```

Kirim sebagai bagian dari body request:

```typescript
body: JSON.stringify({
  message,
  model: activeModelRef.current,
  category: activeCategoryRef.current,
  thinkingEnabled: thinkingEnabledRef.current,
  history: conversationHistory,
  conversationId: activeConversationIdRef.current,
  timezone: userTimezone,  // ← TAMBAH INI
}),
```

**Catatan:** `Intl.DateTimeFormat().resolvedOptions().timeZone` tersedia di semua browser modern (Chrome, Firefox, Safari, Edge). Fallback: jika tidak ada, server akan default ke `'Asia/Jakarta'`.

### Langkah 2: Backend — Terima Parameter timezone

**File:** [`src/app/api/chat/route.ts`](src/app/api/chat/route.ts), baris 79-86

Tambahkan `timezone` ke destructuring:

```typescript
const {
  message,
  model: modelId = 'gpt-4o',
  category = 'chat',
  thinkingEnabled = false,
  history = [],
  conversationId,
  timezone,       // ← TAMBAH INI
} = body;
```

### Langkah 3: Backend — Fungsi buildTimeContext

**File:** [`src/app/api/chat/route.ts`](src/app/api/chat/route.ts), tambahkan fungsi baru (sebelum `POST` atau di area fungsi helper):

```typescript
function buildTimeContext(timezone: string = 'Asia/Jakarta'): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'long',
    });
    return `Sekarang: ${formatter.format(now)}`;
  } catch {
    // Fallback jika timezone tidak valid
    const now = new Date();
    return `Sekarang: ${now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`;
  }
}
```

### Langkah 4: Backend — Gunakan di System Prompt

**File:** [`src/app/api/chat/route.ts`](src/app/api/chat/route.ts), baris 97-101:

```typescript
const systemPrompt = CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.chat;
const timeContext = buildTimeContext(timezone);

const llmMessages: { role: string; content: string }[] = [
  { role: 'system', content: `${systemPrompt}\n\n${timeContext}` },
];
```

---

## 5. Contoh Output

Input dari browser (user di Makassar → `timezone: 'Asia/Makassar'`):

```
Sekarang: Sabtu, 16 Mei 2026 03.30.45 Waktu Indonesia Tengah
```

Input dari browser (user di Jayapura → `timezone: 'Asia/Jayapura'`):

```
Sekarang: Sabtu, 16 Mei 2026 04.30.45 Waktu Indonesia Timur
```

---

## 6. Edge Cases & Penanganan

| Skenario | Dampak | Penanganan |
|----------|--------|------------|
| Browser tidak support `resolvedOptions().timeZone` | `undefined` dikirim | Backend fallback ke `Asia/Jakarta` |
| Timezone string tidak valid (e.g., hacking) | Error di `Intl.DateTimeFormat` | try-catch, fallback `Asia/Jakarta` |
| User di luar Indonesia (e.g., London) | Waktu sesuai zona lokal user | Justru lebih akurat! |
| `id-ID` locale tidak support | Fallback ke format standar | try-catch di `Intl.DateTimeFormat` |
| Token bertambah | ~50 token per request | Dampak minimal pada biaya |

---

## 7. Testing Strategy

1. **Browser test:** `Intl.DateTimeFormat().resolvedOptions().timeZone` di console → pastikan mengembalikan string zona waktu
2. **Backend test:** Panggil `buildTimeContext('Asia/Jayapura')` → output harus mengandung "Waktu Indonesia Timur"
3. **Integration test:** Kirim POST ke `/api/chat` dengan `timezone: 'Asia/Makassar'` → cek system prompt di log/database mengandung waktu yang sesuai
4. **Fallback test:** Kirim tanpa `timezone` → output harus tetap pakai `Asia/Jakarta`

---

## 8. Ringkasan Perubahan

### File 1: [`src/app/page.tsx`](src/app/page.tsx)
**+2 baris, 0 dihapus**
```diff
+ const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  body: JSON.stringify({
    message,
    model: activeModelRef.current,
    category: activeCategoryRef.current,
    thinkingEnabled: thinkingEnabledRef.current,
    history: conversationHistory,
    conversationId: activeConversationIdRef.current,
+   timezone: userTimezone,
  }),
```

### File 2: [`src/app/api/chat/route.ts`](src/app/api/chat/route.ts)
**+16 baris, 1 diubah (line 101)**
```diff
+ function buildTimeContext(timezone: string = 'Asia/Jakarta'): string {
+   try {
+     const now = new Date();
+     const formatter = new Intl.DateTimeFormat('id-ID', {
+       timeZone: timezone,
+       weekday: 'long',
+       year: 'numeric',
+       month: 'long',
+       day: 'numeric',
+       hour: '2-digit',
+       minute: '2-digit',
+       second: '2-digit',
+       timeZoneName: 'long',
+     });
+     return `Sekarang: ${formatter.format(now)}`;
+   } catch {
+     const now = new Date();
+     return `Sekarang: ${now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`;
+   }
+ }

  const { message, model, category, thinkingEnabled, history, conversationId } = body;
+ const { timezone } = body;  // atau tambahkan ke destructuring di atas

  const systemPrompt = CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.chat;
+ const timeContext = buildTimeContext(timezone);
  const llmMessages = [
-   { role: 'system', content: systemPrompt },
+   { role: 'system', content: `${systemPrompt}\n\n${timeContext}` },
  ];
```

---

## 9. Todo Implementasi

1. [`src/app/page.tsx`](src/app/page.tsx): Deteksi timezone dari browser & kirim ke API
2. [`src/app/api/chat/route.ts`](src/app/api/chat/route.ts): Tambahkan fungsi `buildTimeContext(timezone)`
3. [`src/app/api/chat/route.ts`](src/app/api/chat/route.ts): Terima parameter `timezone` dari request body
4. [`src/app/api/chat/route.ts`](src/app/api/chat/route.ts): Gabungkan konteks waktu ke system prompt
5. Test: pastikan streaming tetap berjalan normal
6. Test: tanya ke AI "sekarang jam berapa?" dengan berbagai timezone
