# Rencana Implementasi Produksi AI Chat Web
Tanggal: 2026-05-16
Status: Draft

## 1. Ringkasan Eksekutif
Tujuan dari rencana ini adalah untuk mentransformasi aplikasi AI Chat Web dari versi prototype/demo menjadi versi yang siap untuk pengujian produksi (production-ready). Fokus utama adalah menutup celah keamanan kritis terkait impersonasi user dan mengintegrasikan sistem autentikasi frontend dengan backend secara penuh.

## 2. Analisis Arsitektur Saat Ini vs Target

| Komponen | Kondisi Saat Ini (Demo) | Target Produksi |
| :--- | :--- | :--- |
| **Autentikasi** | Mock logic di Zustand Store | JWT (JSON Web Token) via API |
| **Identitas User** | `userId` dikirim via request body (Insecure) | `userId` diambil dari Token terverifikasi (Secure) |
| **Session** | Boolean `isLoggedIn` di localStorage | Secure `httpOnly` Cookie / Bearer Token |
| **Data User** | Array `demoUsers` di memori | Database MySQL via API |
| **Validasi** | Minimal di sisi server | Validasi ketat menggunakan Zod/Joi |

## 3. Detail Implementasi Step-by-Step

### Tahap 1: Fondasi Keamanan & Autentikasi (Backend)
**Tujuan**: Membangun sistem identitas yang tidak dapat dimanipulasi oleh client.

1.  **Instalasi Dependensi**:
    *   `npm install jsonwebtoken` untuk manajemen token.
    *   `npm install zod` untuk validasi skema input API.
2.  **Update API Auth (`/api/auth/route.ts`)**:
    *   Modifikasi fungsi `login` untuk menghasilkan JWT setelah password diverifikasi via `bcrypt`.
    *   Payload JWT harus berisi `userId` dan `role`.
    *   Set token ke dalam `httpOnly` cookie untuk mencegah serangan XSS.
3.  **Pembuatan Auth Middleware/Helper**:
    *   Membuat fungsi `verifyAuth(request)` yang:
        *   Membaca token dari cookie atau header `Authorization`.
        *   Memverifikasi tanda tangan token.
        *   Mengembalikan `userId` jika valid, atau melempar error 401 jika tidak.

### Tahap 2: Pengamanan Route API (Backend)
**Tujuan**: Menghilangkan semua celah impersonasi user.

1.  **Audit & Refactor Route API**:
    *   **`/api/chat`**: Hapus `userId` dari request body. Gunakan `verifyAuth` untuk mendapatkan `userId`.
    *   **`/api/conversations`**: Hapus `userId` dari query params dan request body. Gunakan `verifyAuth`.
    *   **`/api/account`**, **`/api/usage`**, **`/api/topup`**: Terapkan `verifyAuth`.
2.  **Implementasi Validasi Input**:
    *   Gunakan `zod` untuk memastikan semua input API (seperti `message`, `modelId`) memiliki tipe dan panjang yang benar sebelum diproses.

### Tahap 3: Integrasi Frontend & Store (Frontend)
**Tujuan**: Menghubungkan UI dengan sistem keamanan baru.

1.  **Refactor `src/lib/store.ts`**:
    *   **Hapus Total**: `DEFAULT_DEMO_USERS`, `demoUsers`, dan logika pencarian user di dalam array.
    *   **Update `loginUser`**: Ubah menjadi `async` function yang melakukan `fetch('/api/auth', { action: 'login', ... })`.
    *   **Update `registerUser`**: Ubah menjadi `async` function yang melakukan `fetch('/api/auth', { action: 'register', ... })`.
    *   **Update `logoutUser`**: Panggil API logout untuk menghapus cookie session.
2.  **Implementasi Session Sync**:
    *   Buat endpoint `/api/auth/me` untuk mengambil data profil user yang sedang login.
    *   Tambahkan fungsi `initializeSession()` di store yang dipanggil saat aplikasi pertama kali dimuat untuk memverifikasi session dan mengisi data user/kredit.

### Tahap 4: Pembersihan UI & UX
**Tujuan**: Menghapus semua elemen "demo" dan meningkatkan feedback user.

1.  **Pembersihan Login Page**: Hapus bagian "Akun Demo" dari `src/app/login/page.tsx`.
2.  **Handling Auth Error**: Update UI untuk menampilkan pesan error yang lebih spesifik (misal: "Sesi berakhir, silakan login kembali") saat API mengembalikan 401.
3.  **Loading States**: Pastikan semua aksi auth memiliki state loading yang jelas.

## 4. Strategi Pengujian (Testing Strategy)

1.  **Security Testing**:
    *   Mencoba mengakses `/api/chat` tanpa token $\rightarrow$ Harus 401.
    *   Mencoba mengirim `userId` orang lain dalam request $\rightarrow$ Harus diabaikan oleh server.
    *   Mencoba menggunakan token yang sudah expired $\rightarrow$ Harus 401.
2.  **Functional Testing**:
    *   Alur Register $\rightarrow$ Login $\rightarrow$ Chat $\rightarrow$ Logout.
    *   Verifikasi pengurangan kredit di database setelah chat.
    *   Verifikasi persistensi percakapan setelah refresh halaman.

## 5. Mitigasi Risiko

| Risiko | Mitigasi |
| :--- | :--- |
| Token dicuri via XSS | Gunakan `httpOnly` dan `Secure` cookies. |
| Database overload saat sync | Implementasikan caching sederhana atau optimasi query. |
| User kehilangan session | Implementasikan Refresh Token mechanism jika diperlukan. |

✅ Plan saved to: plans/2026-05-16-production-readiness-plan.md