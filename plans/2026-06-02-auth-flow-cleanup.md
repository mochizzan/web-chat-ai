# Blueprint Arsitektur - Perbaikan Alur Registrasi & Verifikasi OTP

Dokumen ini berisi rancangan teknis untuk menyelesaikan masalah alur pendaftaran, verifikasi, dan pembersihan field input pada formulir autentikasi.

## A. RINGKASAN SISTEM

### Masalah Utama:
1. **No Initial Cooldown**: Tombol "Kirim Ulang Kode" langsung aktif saat pengguna baru saja mendaftar dan masuk ke halaman verifikasi. Ini berisiko spamming server karena SMS/Email OTP pertama baru saja terkirim.
2. **Form Not Reset**: Setelah verifikasi berhasil, field pendaftaran (Nama, Email, Password) tidak dikosongkan. Ketika pengguna beralih atau dialihkan kembali ke login/register, field-field ini masih terisi informasi sensitif (keamanan rendah).
3. **Login Auto-Fill/Autofill Leakage**: Saat beralih ke tab login, data pendaftaran sebelumnya masih tertinggal atau autofill browser terisi secara otomatis tanpa dibersihkan dengan benar.

### Target Solusi:
- Menginisialisasi `countdown` awal sebesar 60 detik saat `EmailVerificationDialog` pertama kali dimuat.
- Menambahkan metode pembersihan form komprehensif (`resetForm`) di [`useAuthForm.ts`](src/hooks/useAuthForm.ts:6).
- Memodifikasi handling `onVerified` pada [`login/page.tsx:146`](src/app/login/page.tsx:146) untuk mengosongkan semua state formulir, mengalihkan `activeTab` ke `'login'`, dan menutup dialog secara rapi.

---

## B. PEMETAAN FILE

Daftar file yang akan diubah untuk mengimplementasikan solusi ini:

1. **[`src/hooks/useAuthForm.ts`](src/hooks/useAuthForm.ts)**
   - Menambahkan fungsi [`resetForm()`](src/hooks/useAuthForm.ts:33) untuk mengosongkan state `name`, `email`, `password`, `errors`, dan menonaktifkan loading.
2. **[`src/components/auth/email-verification-dialog.tsx`](src/components/auth/email-verification-dialog.tsx)**
   - Mengubah inisialisasi state [`countdown`](src/components/auth/email-verification-dialog.tsx:21) dari `0` menjadi `60`.
   - Mengubah aksi tombol sukses (setelah berhasil diverifikasi) agar memanggil handler pembersihan alih-alih navigasi sepihak.
3. **[`src/app/login/page.tsx`](src/app/login/page.tsx)**
   - Memperbarui properti [`onVerified`](src/app/login/page.tsx:146) pada pemanggilan dialog verifikasi untuk menjalankan [`resetForm()`](src/hooks/useAuthForm.ts:33) dan mengalihkan tab aktif ke `'login'`.

---

## C. SPESIFIKASI MODUL

### 1. [`src/hooks/useAuthForm.ts`](src/hooks/useAuthForm.ts)
Modifikasi pada hooks kustom ini diperlukan agar parent form memiliki fungsi pembersih state yang bisa dipanggil secara programatik.

```typescript
// Tambahkan callback resetForm untuk pembersihan menyeluruh
const resetForm = useCallback(() => {
  setEmail('');
  setPassword('');
  setName('');
  setErrors({});
  setLoading(false);
  setShowPassword(false);
}, []);
```

### 2. [`src/components/auth/email-verification-dialog.tsx`](src/components/auth/email-verification-dialog.tsx)
Modifikasi state countdown default:
```typescript
// Dari:
const [countdown, setCountdown] = useState(0);

// Menjadi:
const [countdown, setCountdown] = useState(60);
```

Modifikasi pada komponen layar Sukses (saat `isVerified === true`):
```tsx
<Button
  className="w-full h-11"
  onClick={() => {
    onVerified?.();
    router.push('/login');
  }}
>
  Masuk
</Button>
```

### 3. [`src/app/login/page.tsx`](src/app/login/page.tsx)
Pembersihan state saat dialog ditutup via sukses verifikasi:

```tsx
if (showVerification) {
  return (
    <EmailVerificationDialog
      email={verificationEmail}
      onVerified={() => {
        // Bersihkan data register
        setEmail('');
        setPassword('');
        setName('');
        setErrors({});
        setVerificationEmail('');
        // Alihkan ke form login
        switchTab('login');
        setShowVerification(false);
      }}
    />
  );
}
```

---

## D. ALUR DATA & ERROR

### Alur Normal Registrasi & Verifikasi Sukses:
1. **Registrasi**: Pengguna mengisi form pendaftaran -> klik "Daftar".
2. **Dialog Verifikasi Terbuka**: Dialog dirender, `countdown` langsung diset 60 detik. Tombol "Kirim Ulang Kode" dinonaktifkan (`disabled={countdown > 0}`).
3. **Verifikasi Sukses**: Pengguna mengisi kode 6-digit valid -> klik "Verifikasi".
4. **Handoff & Cleanup**:
   - `onVerified()` dipanggil oleh Dialog Verifikasi.
   - Parent (`LoginPage`) menangkap callback, mengosongkan seluruh state form register (`email`, `password`, `name`).
   - `switchTab('login')` dipanggil untuk mengubah tampilan formulir ke form Login yang bersih.
   - `showVerification` diset `false`, dialog ditutup.
   - Pengguna diarahkan ke form Login yang kosong dan aman.

---

## E. URUTAN EKSEKUSI (UNTUK CODE MODE)

1. **Step 1**: Ubah [`src/hooks/useAuthForm.ts`](src/hooks/useAuthForm.ts) untuk mendefinisikan dan mengembalikan fungsi [`resetForm()`](src/hooks/useAuthForm.ts:33).
2. **Step 2**: Modifikasi [`src/components/auth/email-verification-dialog.tsx`](src/components/auth/email-verification-dialog.tsx) untuk menginisialisasi countdown awal 60 detik dan panggil `onVerified` pada tombol sukses login.
3. **Step 3**: Ubah properti `onVerified` pada [`src/app/login/page.tsx:146`](src/app/login/page.tsx:146) agar mereset seluruh state dan mengalihkan tab ke login.
4. **Step 4**: Verifikasi perubahan dengan menjalankan suite tes: `pnpm test`.
