# Rencana Perbaikan: Model Tidak Muncul di Admin Control Panel & Guest Account

## Ringkasan

Dua masalah utama ditemukan setelah investigasi kode:

1. **Model tidak muncul di Admin Control Panel** — Model dari database tidak tampil di halaman `/admin` karena WebSocket server hanya mengirim model aktif (`active = 1`), Zustand store tidak mempertahankan data `models` setelah refresh, dan Admin Page tidak melakukan fetch ke API `/api/models?all=true` saat mount.

2. **Guest Account muncul di sidebar** — WebSocket server mengirimkan objek user palsu `{ id: 'anonymous', name: 'Guest', role: 'guest' }` ketika user tidak login, menyebabkan Zustand store menganggap ada user yang login (`isLoggedIn = true`), sehingga sidebar menampilkan akun "Guest" yang tidak seharusnya ada.

---

## Arsitektur & Alur Data

### Alur Data Model Saat Ini

```
Database MySQL
  └─ models (active=1, active=0)
       │
       ▼
WebSocket Server (server/websocket.js)
  └─ Query: SELECT * FROM models WHERE active = 1  ← HANYA AKTIF
       │
       ▼  event: "response:initial_sync"
Zustand Store (src/lib/store.ts)
  └─ models: data dari WebSocket
  └─ partialize: models TIDAK dipersist → hilang saat refresh
       │
       ▼
Admin Page (src/app/admin/page.tsx)
  └─ Baca models dari store
  └─ Tidak ada fetch /api/models?all=true → data kosong saat refresh
```

### Alur Data Model (Setelah Perbaikan)

```
Database MySQL
  └─ models (active=1, active=0)
       │
       ├─► WebSocket Server ──► SELECT * FROM models ──► Semua model dikirim
       │
       ├─► Admin Page Mount ──► GET /api/models?all=true ──► Semua model dari DB
       │
       └─► handlePullModels ──► POST /api/admin/sync-models
                              └─► GET /api/models?all=true ──► refresh dari DB
       
Zustand Store
  └─ models: dipersist di localStorage via partialize
  └─ Tidak hilang saat refresh halaman
```

### Alur Data Guest Account Saat Ini

```
WebSocket Server
  └─ user = null → kirim { id: 'anonymous', name: 'Guest', role: 'guest' }
       │
       ▼  event: "response:initial_sync"
websocket-context.tsx
  └─ setUser(data.user)  ← menerima user Guest
       │
       ▼
Zustand Store
  └─ user = { id: 'anonymous', name: 'Guest', role: 'guest' }
  └─ isLoggedIn = true  ← SALAH! Harusnya false
       │
       ▼
Sidebar
  └─ {isLoggedIn && user ? ...} → Tampilkan profil Guest
```

### Alur Data Guest Account (Setelah Perbaikan)

```
WebSocket Server
  └─ user = null → kirim user: null (TANPA fallback guest)
       │
       ▼  event: "response:initial_sync"
websocket-context.tsx
  └─ if data.user && data.user.role !== 'guest' → setUser(data.user)
  └─ if data.user === null → jangan setUser, jangan ubah isLoggedIn
       │
       ▼
Zustand Store
  └─ user tetap null
  └─ isLoggedIn tetap false (atau dari data login sebelumnya)
       │
       ▼
Sidebar
  └─ {isLoggedIn && user ? ...} → false → Tampilkan tombol "Masuk / Daftar"
```

---

## Perubahan yang Dibutuhkan

### File 1: `server/websocket.js`

**Baris 128 — Query models**
```
SEBELUM:
  const models = await pool.execute('SELECT * FROM models WHERE active = 1');

SESUDAH:
  const models = await pool.execute('SELECT * FROM models');
```

**Baris 167 — Fallback user guest**
```
SEBELUM:
  user: user || { id: 'anonymous', name: 'Guest', role: 'guest' },

SESUDAH:
  user: user || null,
```

### File 2: `src/lib/store.ts`

**Baris 543-550 — Partialize (persist)**
```
SEBELUM:
  partialize: (state) => ({
    activeModel: state.activeModel,
    activeCategory: state.activeCategory,
    sidebarOpen: state.sidebarOpen,
    thinkingEnabled: state.thinkingEnabled,
    user: state.user ? { id: state.user.id, name: state.user.name, role: state.user.role } : null,
    isLoggedIn: state.isLoggedIn,
  }),

SESUDAH:
  partialize: (state) => ({
    activeModel: state.activeModel,
    activeCategory: state.activeCategory,
    sidebarOpen: state.sidebarOpen,
    thinkingEnabled: state.thinkingEnabled,
    models: state.models,  // ← TAMBAHKAN
    user: state.user ? { id: state.user.id, name: state.user.name, role: state.user.role } : null,
    isLoggedIn: state.isLoggedIn,
  }),
```

### File 3: `src/context/websocket-context.tsx`

**Baris 99-102 — Handler response:initial_sync**
```
SEBELUM:
  case 'response:initial_sync':
    if (data.models) store.getState().setModels(data.models);
    if (data.user) store.getState().setUser(data.user);
    if (data.credit) store.getState().setCredit(data.credit);
    break;

SESUDAH:
  case 'response:initial_sync':
    if (data.models) store.getState().setModels(data.models);
    if (data.user && data.user.role !== 'guest') {
      store.getState().setUser(data.user);
      if (data.credit) store.getState().setCredit(data.credit);
    } else if (!data.user) {
      // Jangan lakukan apa-apa — user tetap null, isLoggedIn tetap false
      // Jangan panggil setUser(null) agar tidak menimpa user yang sedang login
    }
    break;
```

### File 4: `src/app/admin/page.tsx`

**A. Tambah useEffect fetch models saat mount (setelah access control effect, sekitar baris 173)**

```typescript
// Fetch all models from API on mount
useEffect(() => {
  async function fetchModels() {
    try {
      const response = await fetch('/api/models?all=true');
      if (response.ok) {
        const data = await response.json();
        if (data.models) {
          setModels(data.models);
        }
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  }
  fetchModels();
}, [setModels]);
```

**B. Ubah handlePullModels baris 295 — tambah parameter `?all=true`**

```
SEBELUM:
  const modelsResponse = await fetch('/api/models');

SESUDAH:
  const modelsResponse = await fetch('/api/models?all=true');
```

---

## Daftar Perubahan Detail (Line-by-Line)

### 1. `server/websocket.js`
| Baris | Perubahan |
|-------|-----------|
| 128 | `WHERE active = 1` → hapus klausa WHERE |
| 167 | `user: user || { id: 'anonymous', ... }` → `user: user || null` |

### 2. `src/lib/store.ts`
| Baris | Perubahan |
|-------|-----------|
| 548 | Tambah `models: state.models` di objek partialize |

### 3. `src/context/websocket-context.tsx`
| Baris | Perubahan |
|-------|-----------|
| 99-103 | Filter data.user — hanya setUser jika role bukan 'guest' dan data.user ada |

### 4. `src/app/admin/page.tsx`
| Baris | Perubahan |
|-------|-----------|
| 173-186 | Tambah useEffect baru untuk fetch `/api/models?all=true` saat mount |
| 295 | `fetch('/api/models')` → `fetch('/api/models?all=true')` |

---

## File yang Tidak Perlu Diubah

| File | Alasan |
|------|--------|
| `src/app/api/models/route.ts` | Sudah mendukung parameter `?all=true` (baris 7, 14-16) |
| `src/app/api/auth/me/route.ts` | Sudah benar — hanya return user dari DB, tidak ada guest |
| `src/app/api/admin/sync-models/route.ts` | Hanya handle sinkronisasi, tidak kirim data ke client |
| `src/components/chat/sidebar.tsx` | Sudah benar — `{isLoggedIn && user ? ...} : {login button}` |
| `src/components/chat/model-selector.tsx` | Hanya filter UI, tidak perlu perubahan |

---

## Urutan Implementasi

1. **server/websocket.js** — Perbaiki query models + hapus guest fallback
2. **src/lib/store.ts** — Tambah models ke partialize
3. **src/context/websocket-context.tsx** — Filter guest user di handler
4. **src/app/admin/page.tsx** — Tambah useEffect fetch models + ubah parameter handlePullModels
5. **Restart WebSocket server** — `node server/websocket.js`
6. **Test** — Refresh admin page, periksa semua model muncul + guest account hilang

---

## Edge Cases & Catatan

1. **User sudah login via API auth sebelum WebSocket terkoneksi**: Jika user sudah login (dari `initializeSession`), WebSocket tidak boleh menimpa dengan null. Kode baru sudah mengakomodasi ini dengan tidak memanggil setUser(null) saat data.user null.

2. **WebSocket tidak terkoneksi**: Tanpa WebSocket, models tetap bisa terisi dari:
   - Fetch API saat admin page mount
   - handlePullModels setelah sync
   - Zustand persist dari localStorage

3. **Model dengan active=0 muncul di model-selector**: Di component `model-selector.tsx`, model tidak aktif sudah ditampilkan dengan style `opacity-40 cursor-not-allowed` dengan badge "Offline". User tidak bisa memilih model non-aktif (baris 248-255 handleSelect hanya berlaku jika model.active).

4. **Data duplikasi**: Jika WebSocket mengirim models dan fetch API juga mengirim, pastikan tidak terjadi overwrite yang tidak diinginkan. Urutan kejadian: WebSocket initial_sync → fetch API di admin page. Data terakhir yang masuk akan dipakai.

5. **Cache WebSocket server (baris 16-18)**: Cache 5 menit di WebSocket tidak perlu diubah, karena TTL hanya untuk efisiensi query.

---

## Testing Strategy

1. Buka halaman `/admin` — pastikan semua model dari database muncul (baik active=1 maupun active=0)
2. Filter "Nonaktif" di table admin — pastikan model dengan active=0 muncul
3. Buka halaman utama `/` — pastikan tidak ada akun "Guest" di sidebar
4. Coba klik toggle model di admin — pastikan perubahan status active terlihat di real-time
5. Coba refresh halaman admin — pastikan models tetap muncul (tidak hilang)
6. Coba login dengan akun real — pastikan sidebar menampilkan profil user dengan benar
7. Coba logout — pastikan sidebar kembali menampilkan tombol "Masuk / Daftar"

---

## Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Banyak model non-aktif membebani render | Performa menurun | Pagination sudah ada (10 per halaman) |
| User login terhapus oleh WebSocket | User tiba-tiba logout | Filter guest mencegah setUser(null) menimpa user yang sedang login |
| Data models di localStorage basi | Model list tidak update | Fetch API saat admin page mount selalu ambil data terbaru dari DB |
