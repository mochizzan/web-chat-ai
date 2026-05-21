# Rencana Pembersihan Kode Demo & Mock (Production Readiness)

## 1. Ringkasan Eksekutif
Tujuan dari rencana ini adalah untuk menghapus semua sisa-sisa kode demo, data mock, dan teks placeholder dari aplikasi AI Chat Web. Aplikasi harus sepenuhnya bergantung pada data real dari database dan API. Fitur top-up yang sebelumnya bersifat simulasi akan dinonaktifkan dengan memberikan feedback error kepada pengguna.

## 2. Detail Temuan & Tindakan Perbaikan

### A. Halaman Admin (`src/app/admin/page.tsx`)
Halaman ini memiliki banyak sisa-sisa prototype yang harus dibersihkan.

| Temuan | Lokasi (Baris) | Tindakan Perbaikan |
| :--- | :--- | :--- |
| Destruktur `demoUsers` dari `useChatStore` | 112 | Hapus `demoUsers` dari destruktur store karena sudah tidak ada di `src/lib/store.ts`. |
| Penggunaan `demoUsers` di `UsersSection` | 458, 987, 1011, 1026 | Ganti `demoUsers` dengan state `users` baru yang diambil melalui API `/api/admin/users`. |
| Teks "Mode: Demo / Simulasi" | 1368 | Ubah menjadi "Mode: Produksi" atau hapus baris tersebut. |
| Teks "Auth System: In-Memory (Zustand)" | 1372 | Ubah menjadi "Auth System: JWT / Session Based". |
| Pesan Footer Mode Demo | 1383 | Hapus seluruh blok teks yang menyatakan sistem berjalan dalam mode demo dan data disimpan di memori. |
| Placeholder Input Model | 498, 507, 518, 528, 550, 561, 618, 627, 669 | Ganti placeholder spesifik (seperti "gpt-5", "OpenAI") menjadi lebih generik (contoh: "Masukkan ID Model", "Nama Provider"). |

### B. Dialog Akun (`src/components/chat/account-dialog.tsx`)
Pembersihan pada bagian manajemen kredit dan top-up.

| Temuan | Lokasi (Baris) | Tindakan Perbaikan |
| :--- | :--- | :--- |
| Teks "Pembayaran simulasi untuk demo" | 866 | Hapus teks ini sepenuhnya. |
| Logika Tombol Top-up / Bayar | Handler Pembayaran | Ubah fungsi handler pembayaran agar tidak menambahkan kredit secara otomatis. Sebagai gantinya, panggil `toast` dengan pesan error: **"Maaf, fitur top-up saat ini belum tersedia."** |

### C. State Management (`src/lib/store.ts`)
Penyesuaian nilai default agar tidak terlihat seperti akun demo.

| Temuan | Lokasi (Baris) | Tindakan Perbaikan |
| :--- | :--- | :--- |
| Default Credit `25.0` | 194, 389, 420, 450, 464, 483 | Ubah nilai default kredit dari `25.0` menjadi `0`. Kredit harus didapatkan dari data user real di database. |

## 3. Alur Implementasi Step-by-Step

### Tahap 1: Pembersihan Store & Global State
1. Update `src/lib/store.ts` untuk mengubah semua default credit menjadi `0`.

### Tahap 2: Refactor Halaman Admin
1. Hapus referensi `demoUsers` di `src/app/admin/page.tsx`.
2. Implementasikan `useEffect` untuk mengambil data user real dari `/api/admin/users` saat halaman dimuat.
3. Update `UsersSection` untuk menggunakan data dari API tersebut.
4. Hapus semua teks "Demo", "Simulasi", dan "In-Memory" di bagian `SettingsSection` dan footer.
5. Perbarui semua placeholder input di dialog tambah/edit model.

### Tahap 3: Penyesuaian Fitur Top-up
1. Buka `src/components/chat/account-dialog.tsx`.
2. Hapus teks simulasi pembayaran.
3. Intercept fungsi pembayaran/top-up dan ganti dengan trigger `toast` error.

### Tahap 4: Verifikasi Akhir
1. Pastikan tidak ada kata "demo", "mock", atau "simulasi" yang muncul di UI.
2. Pastikan halaman admin menampilkan data user asli dari database.
3. Pastikan tombol top-up memberikan feedback error yang sesuai.

## 4. Strategi Pengujian
- **Admin Panel**: Login sebagai admin, cek apakah daftar user muncul (data real) dan pastikan tidak ada teks demo.
- **Account Dialog**: Buka menu top-up, coba lakukan pembayaran, pastikan muncul toast error "belum bisa topup".
- **Default State**: Login dengan user baru, pastikan kredit awal adalah 0 (kecuali ditentukan lain di DB).
