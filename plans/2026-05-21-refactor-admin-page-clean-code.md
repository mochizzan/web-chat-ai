# Plan Refactoring: Admin Page (`src/app/admin/page.tsx`)

## Ringkasan

Refactoring total pada halaman admin yang sangat berantakan (messy code) menjadi arsitektur **Clean Code** dengan pemisahan komponen, shared types, state management yang rapi, dan tanpa duplikasi kode — tanpa mengubah fungsionalitas dan tampilan.

---

## 1. Audit Permasalahan (Current State Analysis)

### A. Masalah Formatting & Structure
```
baris 94: seluruh kode dari `function formatCurrency8()` hingga JSX
          terminifikasi (minified 1 line) — TIDAK TERBACA
```

### B. Duplikasi Kode
| Item | Lokasi 1 | Lokasi 2 | Masalah |
|------|----------|----------|---------|
| `interface User` | `page.tsx:86-93` | `admin-user-table.tsx:24-32` | Duplikasi definisi tipe |
| `function formatCurrency8()` | `page.tsx:94` (minified) | `admin-user-table.tsx:18-22` | Duplikasi utility function |
| `function formatCompact()` | `page.tsx:94` (minified) | - | **Unused function** — tidak dipanggil di mana pun |

### C. Unused Imports — page.tsx
| Import | Status | Keterangan |
|--------|--------|------------|
| `Bot` (lucide-react) | ❌ Tidak dipakai | Tidak ada JSX yang menggunakan ikon ini |
| `BarChart3` (lucide-react) | ❌ Tidak dipakai | |
| `Trash2` (lucide-react) | ❌ Tidak dipakai | |
| `TrendingDown` (lucide-react) | ❌ Tidak dipakai | |
| `Zap` (lucide-react) | ❌ Tidak dipakai | |
| `Activity` (lucide-react) | ❌ Tidak dipakai | |
| `Search` (lucide-react) | ❌ Tidak dipakai | Search di-handle oleh AdminUserTable |
| `Filter` (lucide-react) | ❌ Tidak dipakai | |
| `RefreshCw` (lucide-react) | ❌ Tidak dipakai | |
| `Gauge` (lucide-react) | ❌ Tidak dipakai | |
| `AlertTriangle` (lucide-react) | ❌ Tidak dipakai | |
| `MessageSquare` (lucide-react) | ❌ Tidak dipakai | |
| `ArrowLeft` (lucide-react) | ❌ Tidak dipakai | |
| `BarChart`, `Bar`, `LineChart`, `Line` (recharts) | ❌ Tidak langsung dipakai | Di-handle oleh `AnalyticsChart` component |
| `ErrorBoundary` | ❌ Tidak dipakai | Tidak ada wrapper error boundary di JSX |
| `gsap` | ⚠️ Overkill | Hanya untuk entrance animation sederhana |

### D. State Management Redundancy
```typescript
// page.tsx — state redundan (sudah ada di hook dan component)
const [users, setUsers] = useState<User[]>([]);
const [usersPage, setUsersPage] = useState(1);
const [usersLimit] = useState(10);   // tidak pernah berubah — jadi constant
const [usersTotal, setUsersTotal] = useState(0);
const [userSearchQuery, setUserSearchQuery] = useState('');

// Juga redundan dengan props AdminUserTable:
const [creditUserId, setCreditUserId] = useState<string | null>(null);
const [creditAmount, setCreditAmount] = useState('');
```

### E. Masalah useEffect
```typescript
// 1. Access control — menyebabkan flash konten sebelum redirect
useEffect(() => {
  if (!isLoggedIn || user?.role !== 'admin') router.push('/');
}, [isLoggedIn, user, router]);

// 2. GSAP entrance — overkill, ganti CSS
useEffect(() => { gsap.fromTo(...) }, [activeSection]);

// 3. Fetch models
useEffect(() => { fetchModels(true); }, [fetchModels]);

// 4. Fetch users — inline async function dalam useEffect
useEffect(() => {
  async function loadUsers() { ... fetchUsers(...) ... setUsers(data.users) ... }
  loadUsers();
}, [fetchUsers, usersPage, usersLimit, userSearchQuery]);
```

### F. Arsitektur Monolitik
Satu file `page.tsx` menangani **5 section berbeda** (overview, models, users, logs, settings) tanpa dipisah ke sub-komponen → file terlalu panjang, sulit di-maintain.

---

## 2. Arsitektur Target (Post-Refactor)

### Diagram Struktur File

```
src/
├── lib/
│   ├── admin-types.ts          ★ BARU — Shared types
│   └── admin-utils.ts          ★ BARU — Shared utility functions
│
├── components/
│   └── admin/
│       ├── admin-user-table.tsx   ✓ EXISTING (clean)
│       ├── admin-models-table.tsx ★ BARU
│       ├── admin-overview.tsx     ★ BARU
│       ├── admin-logs-view.tsx    ★ BARU
│       ├── admin-settings-panel.tsx ★ BARU
│       ├── admin-sidebar.tsx      ★ BARU
│       └── admin-layout.tsx       ★ BARU
│
├── components/
│   └── auth/
│       └── admin-route-guard.tsx  ★ BARU — Access control wrapper
│
└── app/
    └── admin/
        └── page.tsx               ✨ REFACTORED — Lean & clean
```

### Dependency Graph

```
AdminPage (page.tsx)
  ├── AdminRouteGuard          ← access control
  └── AdminLayout              ← sidebar + content area
       ├── admin-sidebar.tsx   ← navigation
       ├── admin-overview.tsx  ← section: overview
       ├── admin-models-table.tsx ← section: models
       ├── admin-user-table.tsx ← section: users
       ├── admin-logs-view.tsx ← section: logs
       └── admin-settings-panel.tsx ← section: settings
```

---

## 3. Langkah Implementasi Detail

### Langkah 1: Buat Shared Types (`src/lib/admin-types.ts`)

Extract tipe-tipe yang digunakan bersama:

```typescript
// Tipe yang akan dipindahkan dari page.tsx
export type AdminSection = "overview" | "models" | "users" | "logs" | "settings";
export type ModelFilter = "all" | "active" | "maintenance" | "disabled" | "free" | "paid";

// User interface — pindahkan dari duplikasi
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  credit: number;
  totalSpent: number;
  createdAt: string;
}

// Props untuk sidebar items
export interface SidebarItem {
  id: AdminSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}
```

**File affected:**
- `src/app/admin/page.tsx` — hapus tipe-tipe ini
- `src/components/admin/admin-user-table.tsx` — ganti `User` lokal dengan `AdminUser`

### Langkah 2: Buat Shared Utils (`src/lib/admin-utils.ts`)

```typescript
export function formatCurrency8(n: number | string | null | undefined): string {
  const num = Number(n ?? 0);
  if (isNaN(num)) return '$0.00000000';
  return `$${num.toFixed(8)}`;
}

// HAPUS formatCompact — tidak dipakai
```

**File affected:**
- `src/app/admin/page.tsx` — ganti inline function dengan import
- `src/components/admin/admin-user-table.tsx` — ganti inline function dengan import

### Langkah 3: Buat `AdminRouteGuard` (`src/components/auth/admin-route-guard.tsx`)

Ganti useEffect redirect dengan guard component:

```typescript
'use client';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/lib/store';

export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoggedIn } = useChatStore();

  if (!isLoggedIn || user?.role !== 'admin') {
    router.replace('/');
    return null; // Tidak ada flash content
  }

  return <>{children}</>;
}
```

**Reasoning:** Tidak ada flash konten sebelum redirect, reusable untuk halaman admin lain di masa depan.

### Langkah 4: Buat Sub-komponen Section

#### 4a. `admin-sidebar.tsx`
```typescript
'use client';
// Import shared types
// Menampilkan navigasi sidebar dengan ikon
// Props: activeSection, onSectionChange
```

#### 4b. `admin-layout.tsx`
```typescript
'use client';
// Layout wrapper: sidebar (kiri) + content area (kanan)
// Props: activeSection, onSectionChange, children (content)
// CSS animation entrance — ganti GSAP dengan:
// className="animate-in fade-in slide-in-from-bottom-1 duration-400"
```

#### 4c. `admin-models-table.tsx`
Extract section models dari page.tsx:
- Tabel model dengan kolom: nama, status, pricing, actions
- Filter by status (ModelFilter)
- Tombol sync, toggle free, delete

#### 4d. `admin-overview.tsx`
Extract section overview:
- Analytics charts via `useAdminAnalytics` + `AnalyticsChart`
- Summary cards (total users, revenue, etc.)

#### 4e. `admin-logs-view.tsx`
Extract section logs (jika ada implementasi spesifik)

#### 4f. `admin-settings-panel.tsx`
Extract section settings (jika ada implementasi spesifik)

### Langkah 5: Refactor `page.tsx`

Setelah semua sub-komponen dibuat, `page.tsx` menjadi:

```typescript
'use client';
import { useState, useRef } from 'react';
import { AdminRouteGuard } from '@/components/auth/admin-route-guard';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminOverview } from '@/components/admin/admin-overview';
import { AdminModelsTable } from '@/components/admin/admin-models-table';
import { AdminUserTable } from '@/components/admin/admin-user-table';
import { AdminLogsView } from '@/components/admin/admin-logs-view';
import { AdminSettingsPanel } from '@/components/admin/admin-settings-panel';
import type { AdminSection } from '@/lib/admin-types';

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');

  const renderSection = () => {
    switch (activeSection) {
      case 'overview':  return <AdminOverview />;
      case 'models':    return <AdminModelsTable />;
      case 'users':     return <AdminUserTable />;
      case 'logs':      return <AdminLogsView />;
      case 'settings':  return <AdminSettingsPanel />;
    }
  };

  return (
    <AdminRouteGuard>
      <AdminLayout sidebar={<AdminSidebar activeSection={activeSection} onSectionChange={setActiveSection} />}>
        {renderSection()}
      </AdminLayout>
    </AdminRouteGuard>
  );
}
```

### Langkah 6: Clean Up Imports & Dependencies

**Hapus import berikut dari `page.tsx`:**
- `gsap` — ganti dengan CSS animation (`animate-in` Tailwind)
- `Bot, ArrowLeft, BarChart3, Trash2, TrendingDown, Zap, Activity, Search, Filter, RefreshCw, Gauge, AlertTriangle, MessageSquare` dari lucide-react
- `BarChart, Bar, LineChart, Line` dari recharts
- `ErrorBoundary`

**Hapus dependency:**
- `gsap` dari `package.json` jika tidak digunakan di tempat lain

### Langkah 7: Perbaiki State Management

- Pindahkan state `users`, `usersPage`, `usersTotal`, `userSearchQuery` ke hook `useAdminUsers` atau component yang membutuhkan
- `creditUserId`, `creditAmount` tetap di component yang membutuhkan (`admin-user-table.tsx` — sudah benar)

### Langkah 8: CSS Animation (Ganti GSAP)

Ganti GSAP entrance animation dengan Tailwind CSS:

```typescript
// Layout component
<div className="animate-in fade-in slide-in-from-bottom-1 duration-400">
  {children}
</div>
```

Cukup tambahkan `@import 'tailwindcss-animate'` jika belum ada.

---

## 4. Testing Strategy

| Area | Metode | Tools |
|------|--------|-------|
| Fungsionalitas admin | Manual rendering | Visual inspection + browser |
| Semua section render | Unit test (render) | React Testing Library |
| Access control | Test redirect | Jest + Router mock |
| Hooks integration | Integration test | React Testing Library |
| Tidak ada UI regression | Snapshot test | Jest snapshot |

### Checklist Verifikasi:
- [ ] Overview section: chart, summary cards muncul & interaktif
- [ ] Models section: list model, filter, toggle, sync, delete berfungsi
- [ ] Users section: search, pagination, set/add credit berfungsi
- [ ] Logs section: muncul tanpa error
- [ ] Settings section: muncul tanpa error
- [ ] Non-admin user: redirect ke `/`
- [ ] Entrance animation: smooth (CSS)
- [ ] Tidak ada icon broken
- [ ] Tidak ada console error

---

## 5. Risk Mitigation

| Risk | Dampak | Mitigasi |
|------|--------|----------|
| Kode terminifikasi (line 94) sulit diekstrak | Kehilangan fungsionalitas | Baca JSX output browser untuk membandingkan, lakukan refactor bertahap |
| GSAP removal merusak animasi | UI terasa statis | Ganti dengan CSS animation yang setara sebelum hapus GSAP |
| State redundancy refactor | User data tidak terload | Pastikan data flow dari hook → component tetap utuh |
| Circular dependency | Import error | Struktur dependency: types → utils → hooks → components → page (satu arah) |

---

## 6. Daftar File yang Akan Diubah/Dibuat

### File Baru:
| # | File | Deskripsi |
|---|------|-----------|
| 1 | `src/lib/admin-types.ts` | Shared type definitions |
| 2 | `src/lib/admin-utils.ts` | Shared utility functions |
| 3 | `src/components/auth/admin-route-guard.tsx` | Access control guard |
| 4 | `src/components/admin/admin-sidebar.tsx` | Sidebar navigation |
| 5 | `src/components/admin/admin-layout.tsx` | Layout wrapper |
| 6 | `src/components/admin/admin-models-table.tsx` | Models section |
| 7 | `src/components/admin/admin-overview.tsx` | Overview section |
| 8 | `src/components/admin/admin-logs-view.tsx` | Logs section |
| 9 | `src/components/admin/admin-settings-panel.tsx` | Settings section |

### File yang Dimodifikasi:
| # | File | Perubahan |
|---|------|-----------|
| 1 | `src/app/admin/page.tsx` | Rewrite total — lean imports + composition |
| 2 | `src/components/admin/admin-user-table.tsx` | Ganti `User` → `AdminUser` (import shared type), ganti `formatCurrency8` → import shared util |

### File yang Dihapus:
| # | File | Alasan |
|---|------|--------|
| - | Tidak ada file yang dihapus | Semua refactor mempertahankan struktur |

---

✅ Plan saved to: plans/2026-05-21-refactor-admin-page-clean-code.md