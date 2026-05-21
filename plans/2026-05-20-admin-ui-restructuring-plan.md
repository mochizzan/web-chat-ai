# Rencana Migrasi UI Admin Panel: Konsolidasi Analitik ke Overview

## 1. Analisis Struktur Saat Ini
Berdasarkan audit pada [`src/app/admin/page.tsx`](src/app/admin/page.tsx), panel admin menggunakan sistem satu halaman dengan state `activeSection`. Komponen analitik tersebar di tiga bagian:

### A. OverviewSection
- **Metrik Ringkasan (Cards):** Total Users, Conversations, Revenue, Active Users 30d, Total Requests, Total Tokens, Total Cost, Avg Tok/Req.
- **Grafik:**
  - Pengguna Baru (LineChart)
  - Penggunaan Token (LineChart)
  - Distribusi Token per Provider ([`AnalyticsChart`](src/components/ui/analytics-chart.tsx))

### B. AnalyticsSection
- **Metrik Ringkasan (Cards):** Total Requests, Total Tokens, Total Cost, Active Users 30d.
- **Grafik:**
  - Request per Model (BarChart)
  - Penggunaan Token (LineChart) - *Duplikat dari Overview*
  - Distribusi Token per Provider ([`AnalyticsChart`](src/components/ui/analytics-chart.tsx)) - *Duplikat dari Overview*

### C. SettingsSection
- **Informasi Sistem:** Versi, Framework, Mode, Auth, Database.
- **Grafik:**
  - Aktivitas Pengguna (LineChart) - *Duplikat dari Overview (Pengguna Baru)*
  - Permintaan per Model (BarChart) - *Duplikat dari Analytics*

---

## 2. Target Arsitektur Baru
Semua komponen visualisasi data akan dipusatkan di **Overview**, sementara **Settings** hanya akan berisi informasi konfigurasi sistem. Menu **Analytics** akan dihapus sepenuhnya.

### Struktur Overview Baru
1. **Header & Filter:** Periode waktu (Today, 7d, 30d, 1y) dan Export (CSV/JSON).
2. **Summary Grid:** 8 kartu metrik utama (saat ini sudah lengkap).
3. **Charts Grid (Baris 1):**
   - Pengguna Baru (LineChart)
   - Penggunaan Token (LineChart)
4. **Charts Grid (Baris 2):**
   - Request per Model (BarChart) - *Migrasi dari Analytics/Settings*
   - Distribusi Token per Provider (PieChart/AnalyticsChart)

---

## 3. Langkah-Langkah Implementasi

### Tahap 1: Modifikasi `OverviewSection`
- Tambahkan `BarChart` untuk "Request per Model" ke dalam layout grid `OverviewSection`.
- Pastikan data `requestsPerModel` dari hook `useAdminAnalytics` dipetakan dengan benar.

### Tahap 2: Pembersihan `SettingsSection`
- Hapus blok JSX yang merender grafik di dalam `SettingsSection`.
- Hapus pemanggilan hook `useAdminAnalytics` jika tidak lagi diperlukan untuk data non-grafik (namun periksa apakah ada metrik lain yang dibutuhkan).

### Tahap 3: Penghapusan `AnalyticsSection` & Menu
- Hapus definisi fungsi `AnalyticsSection`.
- Hapus `analytics` dari array `SIDEBAR_ITEMS`.
- Hapus pengecekan `activeSection === 'analytics'` di render utama.

### Tahap 4: Refaktor & Cleanup
- Hapus import yang tidak lagi digunakan (misal: `Activity`, `Zap`, `TrendingDown` jika hanya digunakan di section yang dihapus).
- Pastikan `ErrorBoundary` tetap membungkus `OverviewSection`.

---

## 4. Strategi Pengujian
- **Verifikasi Visual:** Pastikan semua grafik muncul di Overview dengan layout yang rapi (responsive).
- **Verifikasi Data:** Pastikan filter periode waktu di Overview memperbarui semua grafik secara sinkron.
- **Navigasi:** Pastikan menu Analytics sudah hilang dari sidebar dan tidak bisa diakses.
- **Error Handling:** Uji coba dengan mematikan API analitik untuk memastikan `ErrorBoundary` menangkap kegagalan dengan benar.

✅ Plan saved to: plans/2026-05-20-admin-ui-restructuring-plan.md