
# Blueprint Perbaikan Statistik Admin Overview Panel

**Tanggal:** 2026-06-03

## A. SYSTEM OVERVIEW: Target Architecture + Feature Scope

Tujuan dari blueprint ini adalah untuk memperbaiki tampilan statistik di panel overview admin, memastikan semua data yang sudah dihitung di backend ditampilkan dengan benar di frontend, dan memperbaiki fungsionalitas selector periode.

**Perbaikan Utama:**
1.  **Memperbaiki fungsionalitas selector periode:** Memastikan perubahan periode waktu (7 hari, 30 hari, dll.) akan memicu pengambilan data baru dari API.
2.  **Menampilkan statistik yang hilang:** Menambahkan kartu UI untuk statistik yang sudah dihitung di backend tetapi belum dirender di frontend.
3.  **Menampilkan tabel top users:** Mengintegrasikan tabel pengguna teratas berdasarkan pengeluaran ke dalam overview panel.

**Komponen yang Terlibat:**
*   [`src/components/admin/admin-overview.tsx`](src/components/admin/admin-overview.tsx)
*   [`src/hooks/useAdminAnalytics.ts`](src/hooks/useAdminAnalytics.ts)
*   [`src/services/analytics.service.ts`](src/services/analytics.service.ts) (Tidak ada perubahan yang diperlukan pada service ini, karena perhitungan backend sudah benar)
*   [`src/repositories/analytics.repo.ts`](src/repositories/analytics.repo.ts) (Tidak ada perubahan yang diperlukan pada repository ini, karena query database sudah benar)

## B. FILE MAPPING: Tree of Files Created/Modified/Moved

```
src/
├── components/
│   └── admin/
│       └── admin-overview.tsx  (Dimodifikasi: Menggunakan hook's handlePeriodChange, menambahkan kartu statistik, menambahkan tabel top users)
└── hooks/
    └── useAdminAnalytics.ts  (Dimodifikasi: Menambahkan export setGranularity, memastikan periode dan granularitas terkelola dengan baik oleh hook)
```

## C. MODULE SPECIFICATIONS: Functions, Logic, State Variables

### 1. `src/components/admin/admin-overview.tsx`
*   **State Variables:**
    *   Hapus state `period` lokal.
*   **Logic:**
    *   Gunakan `handlePeriodChange` dan `period` yang diekspor dari `useAdminAnalytics` hook.
    *   Tambahkan komponen `Card` baru di bagian `Summary Cards` (lines 54-103) untuk menampilkan statistik yang saat ini tidak terlihat (`newUsers24h`, `newUsers7d`, `activeUsers30d`, `totalConversations`, `totalMessages`, `totalCost`, `profit`, `totalTokens`, `totalModels`, `activeModels`).
    *   Tambahkan komponen `Table` baru setelah `Charts Row 2` untuk menampilkan data `topUsersBySpending`.

### 2. `src/hooks/useAdminAnalytics.ts`
*   **State Variables:**
    *   Tidak ada perubahan pada state yang ada.
*   **Logic:**
    *   Pastikan `handlePeriodChange` dan `setGranularity` diekspor dari hook sehingga dapat digunakan oleh komponen `admin-overview.tsx`.
    *   Tidak ada perubahan signifikan pada logika internal hook, karena fungsionalitas pengambilan data dan manajemen state `period`/`granularity` di sini sudah benar.

## D. DATA FLOW & ERROR HANDLING: Data Flow + Failure Handling

### Data Flow Diperbarui:
```mermaid
graph TD
    A[AdminOverview Component] -->|Calls| B(useAdminAnalytics Hook);
    B -->|Fetches data with period & granularity| C(GET /api/admin/analytics);
    C -->|Calls| D(AnalyticsService.getDashboardStats);
    D -->|Queries DB| E(AnalyticsRepository);
    E -->|Returns stats| D;
    D -->|Returns data| C;
    C -->|Returns data| B;
    B -->|Provides data, loading, error, handlePeriodChange, setGranularity| A;
    A -->|Renders Summary Cards, Charts, Top Users Table| F(UI);
    A --on click--> A_HP[Calls hook's handlePeriodChange];
    A_HP --> B;
```

### Error Handling:
*   Error handling yang sudah ada di `useAdminAnalytics` (lines 37-49) dan `admin-overview.tsx` (lines 37-39) sudah memadai. Jika ada kegagalan fetch API, pesan error akan ditampilkan.

## E. EXECUTION SEQUENCE: Step-by-step Instructions for Code Mode

1.  **Perbarui `src/components/admin/admin-overview.tsx`:**
    *   Hapus deklarasi `const [period, setPeriod] = useState('30d');` (line 27).
    *   Modifikasi destructuring `useAdminAnalytics` untuk menyertakan `handlePeriodChange` dari hook:
        ```typescript
        const { data, loading, error, period, handlePeriodChange } = useAdminAnalytics('30d', 'day');
        ```
    *   Tambahkan kartu `Card` baru di dalam `Summary Cards` (`div` dengan class `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`, sekitar line 54) untuk statistik yang belum ditampilkan. Misalnya, untuk `Pengguna Baru 24 jam`, `Pengguna Baru 7 hari`, `Pengguna Aktif 30 hari`, dll. Sesuaikan layout agar tetap responsif.
    *   Tambahkan `Table` untuk `Top Users By Spending` setelah `Charts Row 2`. Gunakan komponen `Table`, `TableHeader`, `TableBody`, `TableHead`, `TableRow`, `TableCell` dari `@/components/ui/table`.
    *   Pastikan semua data statistik ditampilkan dengan format yang sesuai (misalnya `formatCurrency8` untuk nilai mata uang, `.toLocaleString()` untuk angka besar).

2.  **Perbarui `src/hooks/useAdminAnalytics.ts`:**
    *   Perbarui return statement dari hook untuk menyertakan `period` dan `setGranularity`:
        ```typescript
        return {
          data,
          loading,
          error,
          period, // Tambahkan ini
          granularity, // Tambahkan ini
          setGranularity, // Tambahkan ini
          handlePeriodChange,
          refetch: () => fetchData(period, granularity),
          handleExport,
        };
        ```
    *   Di bagian `handlePeriodChange` pastikan `setGranularity` dipanggil:
        ```typescript
        const handlePeriodChange = useCallback((p: string) => {
          setPeriod(p);
          if (p === 'today' || p === '24h') {
            setGranularity('hour');
          } else {
            setGranularity('day');
          }
        }, []);
        ```

3.  **Verifikasi dan Testing:**
    *   Setelah implementasi, jalankan aplikasi dan navigasikan ke halaman admin overview.
    *   Verifikasi bahwa selector periode berfungsi dengan benar dan memicu pembaruan data.
    *   Verifikasi bahwa semua kartu statistik baru menampilkan nilai yang benar.
    *   Verifikasi bahwa tabel top users ditampilkan dengan benar.

