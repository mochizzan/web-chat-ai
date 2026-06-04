# Blueprint: Perbaikan Fitur Show API Key (Tampilkan Full Key)

## 1. Ringkasan Masalah

Saat ini tombol **Show** (ikon Eye) pada dashboard API keys hanya men-toggle `...` pada **key_prefix** (20 karakter pertama), bukan menampilkan **full key** (45 karakter). Hal ini disebabkan oleh:

- Backend **tidak pernah mengembalikan** `full_key` pada endpoint GET list keys
- Database hanya menyimpan **bcrypt hash** (one-way → tidak bisa di-dekripsi)
- Frontend tidak memiliki mekanisme untuk mendapatkan full key setelah key dibuat

---

## 2. Pendekatan yang Dipilih: Enkripsi di Database (AES-256-GCM)

| Aspek | Pendekatan |
|-------|-----------|
| **Penyimpanan** | Simpan full key yang dienkripsi di kolom `encrypted_key` di tabel `api_keys` |
| **Security** | Enkripsi AES-256-GCM dengan key dari `API_KEY_SECRET` (sudah ada di `.env`) |
| **Auth tetap** | bcrypt hash tetap digunakan untuk verifikasi API key di endpoint `v1/chat` |
| **Show** | Endpoint khusus `GET /v1/auth/keys/:id/decode` → decrypt → return full key |
| **Keamanan show** | Memerlukan auth session yang valid (sama seperti endpoint keys lainnya) |

### Mengapa enkripsi (bukan hash) untuk display?

- bcrypt → **one-way**, full key tidak bisa dipulihkan = aman tapi user tidak bisa melihat lagi
- AES-256-GCM → **two-way**, bisa di-decrypt = user bisa melihat, tapi butuh server-side encryption key

---

## 3. Perubahan yang Diperlukan

### 3.1 Database — Migration

Tambahkan kolom `encrypted_key` ke tabel `api_keys`:

```sql
ALTER TABLE api_keys
ADD COLUMN encrypted_key TEXT NULL COMMENT 'Full key dienkripsi AES-256-GCM' AFTER key_hash;
```

### 3.2 Backend — `src/lib/api-key-auth.ts`

**Tambahkan fungsi enkripsi/dekripsi:**

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Dapatkan encryption key dari API_KEY_SECRET (32 byte untuk AES-256)
function getEncryptionKey(): Buffer {
  // API_KEY_SECRET sudah ada di config, kita hash untuk dapat 32 byte konsisten
  return crypto.createHash('sha256').update(API_KEY_SECRET).digest();
}

/**
 * Enkripsi full key untuk disimpan di database.
 * Format output: hex(iv) : hex(authTag) : hex(ciphertext)
 */
export function encryptKey(fullKey: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(fullKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Dekripsi full key dari database.
 */
export function decryptKey(encryptedData: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

### 3.3 Backend — `src/app/v1/auth/keys/route.ts`

**Update `POST` handler** — setelah generate key, simpan juga `encrypted_key`:

```typescript
// Di dalam POST, setelah generateApiKey():
const encryptedKey = encryptKey(fullKey);

await ApiKeyRepository.create({
  id: keyId,
  user_id: userId,
  name,
  key_prefix: keyPrefix,
  key_hash: keyHash,
  encrypted_key: encryptedKey,  // tambahan
  is_active: 1,
});
```

**Update `ApiKeyRepository.create()`** di [`src/repositories/api-key.repo.ts`](src/repositories/api-key.repo.ts):

```typescript
const sql = `INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, encrypted_key, is_active, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
const params = [
  key.id, key.user_id, key.name, key.key_prefix, key.key_hash,
  key.encrypted_key ?? null,  // tambahan
  key.is_active ?? 1,
  key.expires_at ?? null,
];
```

Update interface `ApiKeyRecord` di [`src/repositories/api-key.repo.ts`](src/repositories/api-key.repo.ts):

```typescript
export interface ApiKeyRecord {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  encrypted_key: string | null;  // TAMBAHKAN
  is_active: number;
  last_used_at: Date | null;
  expires_at: Date | null;
  total_requests: number;
  total_tokens: number;
  created_at: Date;
  updated_at: Date;
}
```

### 3.4 Backend — Endpoint Baru `GET /v1/auth/keys/[id]`

Buat file [`src/app/v1/auth/keys/[id]/route.ts`](src/app/v1/auth/keys/[id]/route.ts):

```typescript
import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { decryptKey } from '@/lib/api-key-auth';
import { ApiKeyRepository } from '@/repositories/api-key.repo';

/**
 * GET /v1/auth/keys/:id
 * Mengembalikan full API key (idecrypt dari encrypted_key).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const keyId = params.id;
    const record = await ApiKeyRepository.findById(keyId);
    if (!record) {
      return apiError('API key not found', 404, 'NOT_FOUND');
    }

    // Pastikan key milik user ini (kecuali admin)
    if (auth.role !== 'admin' && record.user_id !== auth.userId) {
      return apiError('Forbidden', 403, 'FORBIDDEN');
    }

    if (!record.encrypted_key) {
      return apiError('Full key tidak tersedia (mungkin key dibuat sebelum fitur ini)', 404, 'NOT_AVAILABLE');
    }

    const fullKey = decryptKey(record.encrypted_key);

    return apiSuccess({
      id: record.id,
      full_key: fullKey,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API Key Decode] error:', err.message);
    return apiError('Gagal mendapatkan full key', 500, 'INTERNAL_ERROR');
  }
}
```

### 3.5 Backend — Update `ApiKeyResponse` Type

Di [`src/types/openai-api.ts`](src/types/openai-api.ts), tambahkan field:

```typescript
export interface ApiKeyResponse {
  id: string;
  name: string;
  key_prefix: string;
  full_key: string | null;
  has_encrypted_key: boolean;  // TAMBAHKAN — untuk frontend tahu apakah key bisa di-show
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  total_requests: number;
  total_tokens: number;
  created_at: string;
}
```

Update [`GET handler`](src/app/v1/auth/keys/route.ts:29) untuk return `has_encrypted_key`:

```typescript
const response: ApiKeyResponse[] = keys.map((k) => ({
  id: k.id,
  name: k.name,
  key_prefix: k.key_prefix,
  full_key: null,
  has_encrypted_key: k.encrypted_key !== null, // TAMBAHKAN
  is_active: k.is_active === 1,
  last_used_at: k.last_used_at?.toISOString() ?? null,
  expires_at: k.expires_at?.toISOString() ?? null,
  total_requests: k.total_requests,
  total_tokens: k.total_tokens,
  created_at: k.created_at.toISOString(),
}));
```

### 3.6 Frontend — [`src/components/dashboard/api-keys-tab.tsx`](src/components/dashboard/api-keys-tab.tsx)

**a) Update `ApiKeyItem` Interface:**

```typescript
interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  has_encrypted_key: boolean;  // TAMBAHKAN
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  total_requests: number;
  total_tokens: number;
}
```

**b) Tambahkan State untuk Menyimpan Full Key:**

```typescript
const [fullKeys, setFullKeys] = useState<Record<string, string>>({});
const [loadingFullKey, setLoadingFullKey] = useState<string | null>(null);
```

**c) Fungsi Fetch Full Key:**

```typescript
const fetchFullKey = async (keyId: string) => {
  // Cek apakah sudah ada di state
  if (fullKeys[keyId]) return;
  
  try {
    setLoadingFullKey(keyId);
    const res = await fetch(`/v1/auth/keys/${keyId}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Gagal mendapatkan full key');
    }
    const data = await res.json();
    if (data.data?.full_key) {
      setFullKeys(prev => ({ ...prev, [keyId]: data.data.full_key }));
    }
  } catch (err) {
    toast({ title: 'Gagal', description: (err as Error).message, variant: 'destructive' });
  } finally {
    setLoadingFullKey(null);
  }
};
```

**d) Update Tombol Show — Fetch Full Key Saat Diklik:**

```typescript
// Handler untuk toggle show
const handleToggleShow = async (keyId: string) => {
  if (showKeyId === keyId) {
    // Sembunyikan
    setShowKeyId(null);
  } else {
    // Tampilkan
    setShowKeyId(keyId);
    // Fetch full key jika belum ada
    if (!fullKeys[keyId]) {
      await fetchFullKey(keyId);
    }
  }
};
```

**e) Update Render Key Display (line ~250-251):**

```tsx
<code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono select-all">
  {showKeyId === key.id && fullKeys[key.id]
    ? fullKeys[key.id]                                      // Show full key jika sudah di-fetch
    : loadingFullKey === key.id
      ? `${key.key_prefix}...` + <Loader2 className="h-3 w-3 inline animate-spin" />
      : showKeyId === key.id
        ? `${key.key_prefix}...`                            // Sedang loading tapi belum ada
        : `${key.key_prefix}...`}                           // Default hidden
</code>
```

**f) Update Tombol Copy — Salin Full Key Jika Tersedia:**

```typescript
<button
  onClick={() => copyToClipboard(
    fullKeys[key.id] || key.key_prefix,  // Jika full key ada, salin itu
    key.id
  )}
  ...
>
```

**g) Update Tooltip Tombol Show:**

```tsx
<button
  onClick={() => handleToggleShow(key.id)}
  className="text-muted-foreground hover:text-foreground"
  title={showKeyId === key.id ? 'Sembunyikan key' : 'Tampilkan full key'} // ← update text
>
  {showKeyId === key.id ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
</button>
```

---

## 4. Diagram Alur Data (Setelah Perbaikan)

```
CREATE KEY:
┌──────────┐   POST /v1/auth/keys   ┌──────────────────┐
│ Frontend │ ──────────────────────→ │    Backend       │
│          │ ←── {full_key, ...} ─── │  generateApiKey() │
└──────────┘                        │  ├─ bcrypt → key_hash   (untuk auth)
                                     │  └─ AES   → encrypted_key (untuk show)
                                     │  Simpan ke DB           │
                                     └──────────────────┘

SHOW KEY:
┌──────────┐   GET /v1/auth/keys/:id  ┌──────────────────┐
│ Frontend │ ───────────────────────→ │    Backend       │
│          │ ←── {full_key} ────────── │  decryptKey()    │
│          │                          │  dari encrypted   │
│ Tampilkan│                          │  di database      │
│ full key │                          └──────────────────┘
```

---

## 5. Daftar File yang Berubah

| # | File | Perubahan |
|---|------|-----------|
| 1 | `plans/2026-06-03-apikey-show-full-key-fix.md` | (file ini) |
| 2 | Database migration (SQL) | Tambah kolom `encrypted_key` |
| 3 | [`src/lib/api-key-auth.ts`](src/lib/api-key-auth.ts) | Tambah `encryptKey()` & `decryptKey()` |
| 4 | [`src/repositories/api-key.repo.ts`](src/repositories/api-key.repo.ts) | Tambah field `encrypted_key` di interface & SQL |
| 5 | [`src/app/v1/auth/keys/route.ts`](src/app/v1/auth/keys/route.ts) | Update POST simpan `encrypted_key`, update GET return `has_encrypted_key` |
| 6 | `src/app/v1/auth/keys/[id]/route.ts` | **File baru** — endpoint decode full key |
| 7 | [`src/types/openai-api.ts`](src/types/openai-api.ts) | Tambah field `has_encrypted_key` di `ApiKeyResponse` |
| 8 | [`src/components/dashboard/api-keys-tab.tsx`](src/components/dashboard/api-keys-tab.tsx) | Tambah state, fetch, & render full key |

---

## 6. Security Notes

| Risiko | Mitigasi |
|--------|----------|
| Encryption key bocor via source code | `API_KEY_SECRET` sudah di `.env`, tidak di repo |
| Session hijacking → bisa show key | Endpoint decode memerlukan auth session yang valid (sama seperti endpoint keys lainnya) |
| Encrypted key di DB dicuri | Tidak bisa di-decrypt tanpa `API_KEY_SECRET` |
| Timing attack | N/A — enkripsi/dekripsi hanya dipanggil dengan auth session |

---

## 7. Testing Checklist

- [ ] Key baru tersimpan dengan `encrypted_key` yang valid
- [ ] `GET /v1/auth/keys` tidak pernah return `full_key` (tetap aman di list)
- [ ] `GET /v1/auth/keys/:id` return `full_key` ter-dekripsi dengan benar
- [ ] `GET /v1/auth/keys/:id` return 403 jika user bukan pemilik key
- [ ] `GET /v1/auth/keys/:id` return 404 jika `encrypted_key` null (key lama)
- [ ] Tombol Show di frontend fetch full key dan menampilkannya
- [ ] Tombol Copy menyalin full key jika sedang ditampilkan
- [ ] Loading state muncul saat fetch full key
- [ ] Key lama (sebelum migration) tidak bisa di-show — tampilkan pesan "Key lama, tidak bisa ditampilkan"

---

## 8. Prioritas & Urutan Eksekusi

1. **Migration DB** — tambah kolom `encrypted_key`
2. **`api-key-auth.ts`** — tambah fungsi `encryptKey` & `decryptKey`
3. **`api-key.repo.ts`** — update interface & SQL
4. **`route.ts` (POST)** — simpan encrypted key saat create
5. **`route.ts` (GET)** — tambah `has_encrypted_key` di response
6. **Buat `[id]/route.ts`** — endpoint decode
7. **`openai-api.ts`** — update type
8. **`api-keys-tab.tsx`** — update frontend
