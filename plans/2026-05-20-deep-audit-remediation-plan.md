# 🛠️ Rencana Remediasi Audit Mendalam: Analisis & Perbaikan Arsitektur Lanjutan

**Tanggal:** 2026-05-20  
**Status:** Siap Dieksekusi  
**Referensi:** Hasil Audit Gelombang 2 terhadap `plans/2026-05-17-professional-industry-transformation.md` dan Log Error Admin.

---

## 📊 1. Ringkasan Eksekutif

Audit mendalam tahap kedua pada proyek `ai-chat-web` telah mengidentifikasi **14 temuan kritis** (bertambah 3 dari audit sebelumnya). Temuan terbaru mencakup kegagalan total pada sistem autentikasi admin dan kerentanan UI terhadap kegagalan API yang menyebabkan aplikasi crash (White Screen of Death). Rencana ini telah diperbarui untuk memprioritaskan perbaikan jalur autentikasi dan resiliensi dashboard.

---

## 🔴 2. Prioritas P0: Keamanan & Koreksi Kritis (Critical)

### 2.1. Duplikasi & Mismatch Konfigurasi JWT_SECRET
- **Masalah:** `JWT_SECRET` tidak sinkron dan memiliki nilai fallback yang berbeda.
  - `src/lib/auth.ts:5` → `'default_secret_key_change_in_production'`
  - `src/services/auth.service.ts:8` → `'default-secret-key-change-me'`
- **Solusi:** Sentralisasi ke `src/config/index.ts`. Gunakan satu sumber kebenaran.

### 2.2. Mismatch Payload JWT (Bug Kritis)
- **Masalah:** 
  - `AuthService.generateToken` menyimpan ID user dalam properti `id`.
  - `verifyAuth` mencoba membaca ID user dari properti `userId`.
- **Dampak:** `verifyAuth` akan selalu mengembalikan `null` (Unauthorized) karena `decoded.userId` tidak ada, meskipun token valid secara kriptografis.
- **Solusi:** Sinkronisasi nama properti menjadi `userId` di kedua tempat.

### 2.3. Kebocoran Log Produksi pada Web Search
- **Masalah:** 38 `console.log` di `src/lib/web-search/index.ts` mencatat data sensitif.
- **Solusi:** Hapus atau ganti dengan logger terstruktur.

### 2.4. Sisa Log Debugging pada Frontend Hooks
- **Masalah:** Log prefix `[DEBUG:B1]`, dll. di hooks utama.
- **Solusi:** Pembersihan total.

---

## 🟠 3. Prioritas P1: Arsitektur & Resiliensi UI (High)

### 3.1. Penanganan Null pada Dashboard Admin (Fix TypeError)
- **Masalah:** `SettingsSection` dan `OverviewSection` di `src/app/admin/page.tsx` langsung mengakses `data.newUsersOverTime` tanpa pengecekan null.
- **Dampak:** Aplikasi crash saat API analytics gagal (misal: karena 401).
- **Solusi:** Tambahkan *optional chaining* (`data?.newUsersOverTime`) dan pastikan komponen menangani status `error` dari hook sebelum merender grafik.

### 3.2. Perbaikan Error Handling `useAdminUsers`
- **Masalah:** Log `Error: [object Object]` menyulitkan debugging.
- **Solusi:** Perbaiki `fetchUsers` di `src/hooks/useAdminUsers.ts` agar melakukan stringify pada error object atau mengambil pesan error yang spesifik dari respons API.

### 3.3. Inkonsistensi Port WebSocket
- **Masalah:** Mismatch port `8080` vs `3003`.
- **Solusi:** Sinkronisasi ke `3003`.

### 3.4. Pembersihan `eslint-disable any` di 25 File
- **Solusi:** Definisikan interface yang tepat.

---

## 🟡 4. Prioritas P2: Kualitas Kode & UX (Medium)

### 4.1. Implementasi Error Boundary per Komponen
- **Solusi:** Bungkus `OverviewSection`, `ModelsSection`, dll. dengan `ErrorBoundary`.

### 4.2. Mekanisme Retry pada API Hooks
- **Solusi:** Tambahkan logika retry pada `useAdminAnalytics`.

---

## 🛠️ 5. Langkah-Langkah Implementasi

1.  **Fase 1 (P0 - Jalur Autentikasi):**
    - Buat `src/config/index.ts` untuk sentralisasi `JWT_SECRET`.
    - Perbaiki `AuthService.generateToken` agar menggunakan key `userId`.
    - Update `verifyAuth` untuk menggunakan config baru.
2.  **Fase 2 (P1 - Resiliensi Dashboard):**
    - Update `src/app/admin/page.tsx` dengan optional chaining pada seluruh akses data analytics.
    - Perbaiki penanganan error di `useAdminUsers.ts`.
    - Sinkronisasi port WebSocket.
3.  **Fase 3 (P2 - Pembersihan & Refactor):**
    - Hapus `chat.service.ts` (deprecated).
    - Pembersihan log debugging.
    - Refactor `any` pada file prioritas.

---

## 🧪 6. Strategi Verifikasi

- **Auth Test:** Login sebagai admin dan pastikan akses ke `/api/admin/analytics` mengembalikan 200 OK, bukan 401.
- **Resilience Test:** Simulasikan kegagalan API (misal: matikan server atau ubah token) dan pastikan dashboard admin menampilkan pesan error yang ramah, bukan White Screen.
- **Static Analysis:** `npm run lint` harus bersih dari log debugging.

✅ **Plan updated and saved to: plans/2026-05-20-deep-audit-remediation-plan.md**
