# Rencana Perbaikan Komprehensif Sistem (Remediation Plan)
Tanggal: 2026-05-20
Status: Draft / Planning

## 1. Pendahuluan & Tujuan
Dokumen ini merinci rencana perbaikan untuk mengatasi beberapa masalah kritis yang ditemukan selama audit sistem, termasuk crash pada panel admin, kegagalan API, masalah aksesibilitas UI, dan fitur yang hilang (Web Search Toggle). Tujuan utamanya adalah mengembalikan stabilitas sistem, memastikan integritas data, dan meningkatkan pengalaman pengguna (UX) serta aksesibilitas.

## 2. Analisis Masalah & Root Cause

### A. Crash Halaman Admin (`SettingsSection`)
- **Gejala:** Aplikasi crash (White Screen/TypeError) saat membuka menu Settings di Control Panel Admin.
- **Root Cause:** Komponen `SettingsSection` mencoba mengakses properti `newUsersOverTime` dari objek `data` yang masih bernilai `null` saat proses fetching data analitik sedang berlangsung. Tidak ada pengecekan `loading` state sebelum render data.
- **Lokasi:** `src/app/admin/page.tsx` -> `SettingsSection()`.

### B. Kegagalan API Pengambilan Data User & Bug Logging
- **Gejala 1:** Error `Error fetching users: {}` muncul di console.
- **Root Cause 1:** Bug pada logging di `useAdminUsers.ts`. Penggunaan `JSON.stringify(error)` pada objek `Error` di JavaScript menghasilkan `{}` karena properti `message` dan `stack` bersifat non-enumerable.
- **Gejala 2:** Error `Gagal mengambil data pengguna` muncul dan tabel user kosong.
- **Root Cause 2:** API Route `/api/admin/users` mengembalikan respon non-OK (500 Internal Server Error). Hal ini kemungkinan disebabkan oleh:
    1. Kesalahan query pada `UserRepository.listUsers` (terutama pada bagian `LIMIT` dan `OFFSET` yang terkadang sensitif terhadap tipe data atau placeholder pada beberapa versi MySQL driver).
    2. Masalah otentikasi/otorisasi pada `verifyAuth`.
    3. Ketidaksesuaian skema database dengan query yang dijalankan.
- **Lokasi:** `src/hooks/useAdminUsers.ts`, `src/app/api/admin/users/route.ts`, dan `src/repositories/user.repo.ts`.

### C. Warning Aksesibilitas Dialog (Radix UI)
- **Gejala:** Warning `Missing Description or aria-describedby={undefined} for {DialogContent}` di console browser.
- **Root Cause:** Penggunaan `DialogContent` tanpa menyertakan `DialogDescription`. Radix UI mewajibkan deskripsi untuk memenuhi standar ARIA agar screen reader dapat menginformasikan tujuan dialog kepada pengguna.
- **Lokasi:** `src/components/chat/sidebar.tsx`, `src/components/chat/model-selector.tsx`, `src/components/chat/account-dialog.tsx`.

### D. Hilangnya Toggle Web Search
- **Gejala:** Pengguna tidak dapat mengaktifkan/menonaktifkan fitur Web Search karena tombol toggle tidak ada di UI.
- **Root Cause:** Komponen UI untuk toggle `webSearchEnabled` hilang atau belum diimplementasikan, meskipun state-nya sudah tersedia di `useChatDataStore` dan indikator pencarian sudah ada di `message-list.tsx`.
- **Lokasi:** `src/components/chat/top-bar.tsx` atau `src/components/chat/sidebar.tsx`.

---

## 3. Strategi Perbaikan Detail

### 🛠️ Modul 1: Stabilitas Admin Panel
**Tujuan:** Menghilangkan crash dan memastikan render yang aman.
- **Implementasi:**
    - Modifikasi `SettingsSection` di `src/app/admin/page.tsx`.
    - Tambahkan pengecekan `if (loading)` untuk menampilkan skeleton loader.
    - Tambahkan pengecekan `if (error)` untuk menampilkan pesan error yang user-friendly.
    - Gunakan *optional chaining* (`data?.newUsersOverTime`) pada semua akses data analitik.
    - Pastikan `ErrorBoundary` membungkus section yang rentan crash.

### 🛠️ Modul 2: Perbaikan API, Data Layer & Logging
**Tujuan:** Memastikan data user dapat diambil dengan benar dan error terlaporkan dengan jelas.
- **Implementasi:**
    - **Client-side Logging:** Ubah `console.error('Error fetching users:', JSON.stringify(error))` menjadi `console.error('Error fetching users:', error)` atau akses `error.message` secara eksplisit di `src/hooks/useAdminUsers.ts`.
    - **Server-side Debugging:** Tambahkan logging detail di `src/app/api/admin/users/route.ts` untuk mencetak stack trace error yang sebenarnya dari database ke server console.
    - **Query Optimization:** Audit `UserRepository.listUsers` di `src/repositories/user.repo.ts`. Pastikan `limit` dan `offset` dikirim sebagai angka murni. Jika masalah berlanjut, pertimbangkan untuk melakukan interpolasi manual yang aman untuk `LIMIT` dan `OFFSET` karena beberapa driver MySQL tidak mendukung placeholder untuk klausa tersebut.
    - **Auth Verification:** Pastikan `verifyAuth` tidak mengembalikan `null` secara tidak terduga untuk user dengan role admin.

### 🛠️ Modul 3: Restorasi Fitur Web Search
**Tujuan:** Mengembalikan kontrol Web Search kepada pengguna.
- **Implementasi:**
    - Tambahkan komponen `Switch` dari `@/components/ui/switch` ke dalam `TopBar` (di samping model selector) atau `Sidebar`.
    - Hubungkan `Switch` tersebut dengan state `webSearchEnabled` dan action `setWebSearchEnabled` dari `useChatStore`.
    - Tambahkan tooltip atau label "Web Search" untuk kejelasan fungsi.
    - Verifikasi bahwa perubahan state tersimpan di `localStorage` melalui middleware `persist` Zustand.

### 🛠️ Modul 4: Audit Aksesibilitas UI
**Tujuan:** Menghilangkan warning console dan meningkatkan inklusivitas.
- **Implementasi:**
    - Identifikasi semua penggunaan `DialogContent`.
    - Tambahkan `<DialogDescription>` di bawah `<DialogTitle>`. Jika deskripsi tidak diperlukan secara visual, gunakan kelas `sr-only` (screen-reader only) dari Tailwind CSS.
    - Alternatif: Tambahkan `aria-describedby={undefined}` pada `DialogContent` jika dialog tersebut memang tidak membutuhkan deskripsi.

---

## 4. Urutan Implementasi (Step-by-Step)

### Fase 1: Critical Fixes (Stabilitas & Data)
1. **Step 1.1:** Perbaiki `SettingsSection` di `src/app/admin/page.tsx` $\rightarrow$ **Hasil: Tidak ada crash saat buka Settings.**
2. **Step 1.2:** Perbaiki logging di `useAdminUsers.ts` $\rightarrow$ **Hasil: Error log di console informatif (bukan `{}`).**
3. **Step 1.3:** Debug dan perbaiki `UserRepository.listUsers` & API Route $\rightarrow$ **Hasil: Tabel User terisi data.**

### Fase 2: Feature Restoration (Fungsionalitas)
4. **Step 2.1:** Implementasi Toggle Web Search di `TopBar` $\rightarrow$ **Hasil: Fitur Web Search bisa di-on/off.**
5. **Step 2.2:** Verifikasi flow Web Search dari UI $\rightarrow$ Backend $\rightarrow$ UI Indicator.

### Fase 3: UI/UX Polish (Kualitas)
6. **Step 3.1:** Perbaikan `DialogDescription` di semua modal $\rightarrow$ **Hasil: Console bersih dari warning aksesibilitas.**
7. **Step 3.2:** Final audit pada seluruh flow Admin dan Chat.

---

## 5. Strategi Pengujian

| Masalah | Metode Pengujian | Kriteria Keberhasilan |
| :--- | :--- | :--- |
| Crash Admin | Manual: Buka menu Settings $\rightarrow$ Tunggu loading $\rightarrow$ Cek render | Halaman render sempurna tanpa crash |
| API User | Manual: Buka menu Users $\rightarrow$ Cek tabel $\rightarrow$ Cek Network Tab | Status 200 OK, data user muncul di tabel |
| Logging Error | Manual: Trigger error API $\rightarrow$ Cek console | Pesan error terlihat jelas, bukan `{}` |
| Web Search | Manual: Toggle Switch $\rightarrow$ Kirim pesan $\rightarrow$ Cek indikator search | State berubah, indikator search muncul saat aktif |
| Aksesibilitas | Console Log: Buka semua modal $\rightarrow$ Cek warning | Tidak ada warning `Missing Description` |

## 6. Mitigasi Risiko
- **Risiko:** Perubahan pada `UserRepository` mungkin berdampak pada fitur user lainnya.
- **Mitigasi:** Lakukan backup pada file repository sebelum perubahan dan jalankan unit test pada `repositories/__tests__/user.repo.test.ts`.
- **Risiko:** Penambahan `DialogDescription` mungkin merusak layout modal.
- **Mitigasi:** Gunakan kelas `sr-only` untuk menjaga tampilan visual tetap konsisten sambil memenuhi syarat aksesibilitas.

✅ Plan saved to: plans/2026-05-20-comprehensive-fix-plan.md
