# Rencana Implementasi Sistem Penanganan Kredit Rendah (Tiered Warning System)

## 1. Ringkasan Arsitektur
Sistem ini akan mengubah alur pengiriman pesan dari sepenuhnya *post-paid* menjadi *hybrid pre-flight check*. Sebelum permintaan dikirim ke LLM (OmniRouter), sistem akan melakukan estimasi biaya dan membandingkannya dengan saldo kredit user. Jika saldo berada di bawah threshold tertentu, sistem akan mengirimkan peringatan melalui SSE (Server-Sent Events) atau memblokir permintaan jika saldo tidak mencukupi.

### Alur Data (Data Flow)
`User Request` $\rightarrow$ `Auth Verify` $\rightarrow$ `Fetch User Credit` $\rightarrow$ `Estimate Cost` $\rightarrow$ `Threshold Check` $\rightarrow$ `(SSE Warning / SSE Error / Execute LLM)`

---

## 2. Definisi Threshold & Logika Peringatan

Untuk menghindari kondisi "terlalu mepet" ke angka 0, kita akan menggunakan sistem threshold bertingkat:

| Level | Kondisi (Saldo Kredit) | Aksi Sistem | Pesan / Feedback |
| :--- | :--- | :--- | :--- |
| **Normal** | $\ge \$1.00$ | Lanjutkan eksekusi. | Tidak ada notifikasi. |
| **Low** | $\$0.20 \le \text{Saldo} < \$1.00$ | Lanjutkan + Kirim `credit_warning` (Low). | "Kredit Anda rendah. Pertimbangkan untuk top-up agar percakapan tidak terputus." |
| **Critical** | $\$0.05 \le \text{Saldo} < \$0.20$ | Lanjutkan + Kirim `credit_warning` (Critical). | "Kredit Anda sangat rendah! Segera top-up untuk menghindari pemblokiran pesan." |
| **Blocking** | $\text{Saldo} < (\text{Estimasi Biaya} \times 1.2)$ | **Blokir Request** + Kirim `credit_error`. | "Kredit tidak cukup untuk mengirim pesan ini. Silakan top-up atau gunakan model gratis." |

*Catatan: Pengali $1.2$ (buffer 20%) digunakan untuk mengantisipasi output LLM yang lebih panjang dari estimasi.*

---

## 3. Strategi Estimasi Biaya yang Akurat

Estimasi dilakukan sebelum pemanggilan API LLM menggunakan fungsi yang sudah ada di `src/app/api/chat/route.ts`.

### A. Estimasi Token Input
Menggunakan fungsi `estimateTokens(text)` pada seluruh konten pesan (System Prompt + History + User Message).
$$\text{Input Tokens} = \text{estimateTokens}(\text{allMessages})$$

### B. Estimasi Token Output (Safe Buffer)
Karena panjang output tidak bisa diketahui sebelumnya, kita akan menggunakan **Safe Buffer** sebesar **1.000 token**. Angka ini dianggap cukup untuk sebagian besar respon AI standar.
$$\text{Output Tokens (Estimated)} = 1.000$$

### C. Kalkulasi Total Estimasi
Menggunakan fungsi `calculateCost()`:
$$\text{Estimated Cost} = \text{calculateCost}(\text{Input Tokens}, 1.000, \text{modelPricing})$$

---

## 4. Detail Implementasi Teknis

### A. Backend (`src/app/api/chat/route.ts`)
Modifikasi dilakukan di dalam `ReadableStream` sebelum fase pemanggilan LLM:

1. **Penempatan Logika**: Letakkan pengecekan setelah `llmMessages` disusun dan sebelum `fetch(OMNIROUTER_BASE)`.
2. **Implementasi Check**:
   - Ambil `creditRemaining` dari database.
   - Hitung `estimatedCost`.
   - Jalankan logika threshold (Blocking $\rightarrow$ Critical $\rightarrow$ Low).
3. **Pengiriman Event SSE**:
   - `safeEnqueue(sendEvent({ type: 'credit_warning', level: 'low' | 'critical', message: '...' }))`
   - `safeEnqueue(sendEvent({ type: 'credit_error', code: 'INSUFFICIENT_CREDITS', message: '...' }))`
4. **Pemutusan Koneksi**: Jika masuk level `Blocking`, panggil `controller.close()` segera setelah mengirim `credit_error`.

### B. Frontend (UI/UX)
Frontend harus mendengarkan event SSE baru di handler stream:

1. **Handling `credit_warning`**:
   - Tampilkan notifikasi menggunakan `sonner` toast.
   - Warna toast: Kuning untuk `low`, Oranye/Merah untuk `critical`.
2. **Handling `credit_error`**:
   - Hentikan indikator loading.
   - Tampilkan dialog modal (menggunakan `account-dialog.tsx`) yang menginformasikan saldo tidak cukup dan menyediakan tombol cepat menuju halaman Top-up.

---

## 5. Skenario Pengujian (Test Cases)

| Skenario | Saldo User | Estimasi Biaya | Hasil yang Diharapkan |
| :--- | :--- | :--- | :--- |
| **Saldo Melimpah** | $\$10.00$ | $\$0.01$ | Pesan terkirim, tidak ada warning. |
| **Saldo Rendah** | $\$0.50$ | $\$0.01$ | Pesan terkirim, muncul toast "Low Credit". |
| **Saldo Kritis** | $\$0.10$ | $\$0.01$ | Pesan terkirim, muncul toast "Critical Credit". |
| **Saldo Tidak Cukup** | $\$0.005$ | $\$0.01$ | Pesan **diblokir**, muncul dialog Top-up. |
| **Model Gratis** | $\$0.00$ | $\$0.00$ | Pesan terkirim (karena `modelPricing.free === true`). |

---

## 6. Mitigasi Risiko
- **Over-blocking**: Jika buffer 1.000 token terlalu besar untuk model murah, user mungkin terblokir padahal saldo sebenarnya cukup. Solusi: Sesuaikan buffer berdasarkan `modelId`.
- **Race Condition**: Saldo berubah saat stream sedang berjalan. Solusi: Tetap pertahankan pemotongan kredit di akhir stream (post-paid) sebagai sumber kebenaran utama.
