# Rencana Perbaikan UX & Bug Fix Sistem Kredit

## 1. Ringkasan Masalah
Setelah implementasi awal sistem penanganan kredit rendah, ditemukan dua isu utama yang mempengaruhi pengalaman pengguna (UX):

1.  **Optimistic Message Leak (Bug)**: Saat backend mengirimkan `credit_error` (karena saldo tidak cukup), pesan user yang ditambahkan secara optimis ke store tetap muncul di UI. Hal ini menciptakan kesan bahwa pesan terkirim namun tidak dijawab, yang membingungkan pengguna.
2.  **Toast Spam (UX Issue)**: Peringatan `credit_warning` dikirimkan oleh backend pada setiap request jika saldo berada di bawah threshold. Hal ini menyebabkan toast muncul berulang kali pada setiap pesan, yang mengganggu konsentrasi pengguna.

---

## 2. Solusi Teknis

### A. Perbaikan Optimistic Message Leak
**Tujuan**: Menghapus pesan user dari riwayat chat jika permintaan diblokir karena masalah kredit.

**Detail Implementasi**:
- **Lokasi**: `src/app/page.tsx` $\rightarrow$ fungsi `processSSEStream` $\rightarrow$ handler `case 'credit_error'`.
- **Logika**:
    1.  Tangkap event `credit_error`.
    2.  Akses state `messages` dari `useChatStore`.
    3.  Lakukan filter untuk menghapus pesan yang memiliki ID sama dengan `tempId` (ID pesan optimis yang dibuat saat `handleSend`).
    4.  Update store dengan daftar pesan yang telah difilter.
    5.  Tampilkan toast error dan buka `AccountDialog`.

### B. Implementasi Anti-Spam Warning
**Tujuan**: Membatasi frekuensi munculnya toast peringatan kredit rendah agar tidak mengganggu pengguna.

**Detail Implementasi**:
- **Lokasi**: `src/app/page.tsx` $\rightarrow$ Komponen `Home`.
- **Mekanisme**: Menggunakan `useRef` untuk melacak waktu terakhir peringatan ditampilkan.
- **Logika**:
    1.  Buat ref `lastWarningTimestamp = useRef<number>(0)`.
    2.  Tentukan interval minimum antar peringatan (misal: 10 menit atau 300.000 ms).
    3.  Saat menerima event `credit_warning`:
        - Cek apakah `Date.now() - lastWarningTimestamp.current > INTERVAL`.
        - Jika **Ya**: Tampilkan toast dan update `lastWarningTimestamp.current = Date.now()`.
        - Jika **Tidak**: Abaikan toast (tetap proses request LLM seperti biasa).

---

## 3. Langkah-Langkah Implementasi (Step-by-Step)

### Tahap 1: Penanganan Bug Pesan Optimis
1.  Buka `src/app/page.tsx`.
2.  Cari blok `switch (event.type)` di dalam `processSSEStream`.
3.  Modifikasi `case 'credit_error'` untuk menyertakan logika penghapusan pesan berdasarkan `tempId`.

### Tahap 2: Implementasi Anti-Spam Warning
1.  Di dalam komponen `Home` di `src/app/page.tsx`, tambahkan `const lastWarningTimestamp = useRef<number>(0);`.
2.  Modifikasi `case 'credit_warning'` di dalam `processSSEStream`.
3.  Tambahkan kondisi pengecekan waktu sebelum memanggil fungsi `toast()`.

### Tahap 3: Verifikasi & Testing
1.  **Test Case 1 (Blocking)**: Set kredit user menjadi sangat rendah $\rightarrow$ Kirim pesan $\rightarrow$ Pastikan toast error muncul, dialog akun terbuka, dan **pesan user hilang dari layar**.
2.  **Test Case 2 (Warning Spam)**: Set kredit user ke level `low` $\rightarrow$ Kirim pesan pertama (toast harus muncul) $\rightarrow$ Kirim pesan kedua segera (toast **tidak boleh** muncul).
3.  **Test Case 3 (Warning Interval)**: Tunggu hingga interval waktu terlampaui $\rightarrow$ Kirim pesan $\rightarrow$ Pastikan toast muncul kembali.

---

## 4. Analisis Dampak & Mitigasi Risiko Mendalam

Untuk memastikan sistem ini tidak hanya berfungsi secara teknis tetapi juga memberikan pengalaman pengguna yang superior, berikut adalah analisis risiko mendalam dan strategi mitigasinya:

### A. Risiko Psikologis & UX (The "Jarring" Effect)
**Skenario**: User mengirim pesan panjang $\rightarrow$ Pesan muncul (optimis) $\rightarrow$ Tiba-tiba pesan hilang karena `credit_error`.
- **Dampak**: User merasa aplikasi "error" atau pesan mereka "dihapus paksa", yang dapat memicu frustrasi.
- **Mitigasi Mendalam**:
    - **Visual Feedback**: Jangan hanya menghapus pesan, tetapi tampilkan toast error yang sangat spesifik: *"Pesan tidak dapat dikirim karena saldo kredit tidak mencukupi."*
    - **Direct Action**: Segera buka `AccountDialog` sehingga user tidak perlu mencari menu top-up secara manual.
    - **Alternative**: (Opsional) Mengubah status pesan menjadi `failed` dengan label "Kredit Tidak Cukup" daripada menghapusnya sepenuhnya. Namun, untuk menjaga kebersihan riwayat chat, penghapusan dengan toast yang jelas adalah pilihan utama.

### B. Risiko Inkonsistensi Peringatan (Warning Gap)
**Skenario**: User berada di level `Critical` $\rightarrow$ Mendapat warning $\rightarrow$ Mengirim beberapa pesan (warning tidak muncul karena interval anti-spam) $\rightarrow$ Tiba-tiba terblokir.
- **Dampak**: User merasa sistem tidak konsisten karena tidak diperingatkan tepat sebelum pemblokiran terjadi.
- **Mitigasi Mendalam**:
    - **Tiered Interval**: Terapkan interval yang berbeda berdasarkan level.
        - `Low Warning`: Interval 10-15 menit (Sangat longgar).
        - `Critical Warning`: Interval 2-3 menit atau tampilkan setiap kali saldo turun di bawah angka tertentu (Sangat ketat).
    - **Priority Override**: Jika saldo sudah berada di zona `Blocking`, abaikan semua interval dan langsung eksekusi pemblokiran dengan pesan yang tegas.

### C. Risiko Teknis: State Synchronization & Race Conditions
**Skenario**: User mengirim pesan dengan sangat cepat atau terjadi update state dari WebSocket saat `credit_error` diproses.
- **Dampak**: `tempId` mungkin tidak ditemukan atau terjadi penghapusan pesan yang salah jika state tidak sinkron.
- **Mitigasi Mendalam**:
    - **Atomic Update**: Gunakan `useChatStore.getState().setMessages()` dengan fungsi filter yang murni berdasarkan `tempId` yang unik (timestamp + random string).
    - **Strict ID Matching**: Pastikan `tempId` dikirimkan kembali atau disimpan dalam closure `processSSEStream` untuk menjamin pesan yang dihapus adalah pesan yang tepat.

### D. Risiko Over-Blocking (False Positive)
**Skenario**: Buffer 1.000 token terlalu besar untuk model yang sangat murah, sehingga user terblokir padahal saldo sebenarnya cukup untuk jawaban singkat.
- **Dampak**: User merasa terbatasi secara tidak adil.
- **Mitigasi Mendalam**:
    - **Dynamic Buffer**: Sesuaikan buffer output berdasarkan harga model. Model mahal $\rightarrow$ Buffer lebih kecil (karena biaya per token tinggi), Model murah $\rightarrow$ Buffer lebih besar.
    - **Grace Period**: Memberikan toleransi kecil (misal: tetap izinkan jika sisa saldo $< 10\%$ dari estimasi) untuk menghindari pemblokiran yang terlalu agresif.

### E. Risiko Performa (Frontend Overhead)
**Skenario**: Pengecekan timestamp dan filter pesan dilakukan pada setiap event SSE.
- **Dampak**: Potensi lag pada UI saat streaming teks yang sangat cepat.
- **Mitigasi Mendalam**:
    - **Ref-based Tracking**: Menggunakan `useRef` untuk `lastWarningTimestamp` agar tidak memicu re-render komponen `Home` setiap kali pengecekan dilakukan.
    - **Event Filtering**: Lakukan pengecekan kredit hanya pada event `init` atau event khusus, bukan pada setiap chunk `delta`.

---

## 5. Definisi Selesai (Definition of Done)
- [ ] Pesan optimis terhapus otomatis saat terjadi `credit_error`.
- [ ] Toast `credit_warning` tidak muncul pada setiap pesan (terkontrol oleh interval).
- [ ] Alur UX terasa lebih halus dan tidak mengganggu.
- [ ] Tidak ada regresi pada fungsi chat utama.
