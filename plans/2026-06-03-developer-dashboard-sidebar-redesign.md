# Developer Dashboard Sidebar Redesign + Timezone Fix

**Date:** 2026-06-03  
**Scope:** Fix dashboard stats bug + redesign developer dashboard with sidebar navigation

---

## A. SYSTEM OVERVIEW

### Problem
1. Dashboard developer menampilkan **0** untuk Total Request, Total Token, dan Total Biaya
2. Tampilan dashboard developer menggunakan tab horizontal biasa — kurang modern dan tidak punya sidebar navigasi

### Root Cause: Timezone Mismatch
- JavaScript `toISOString()` → selalu UTC
- MySQL session timezone → UTC+7 (SYSTEM)
- Query summary menggunakan `WHERE created_at <= ?` dengan string UTC, tapi MySQL interpret sebagai UTC+7
- Akibat: endDate 7 jam lebih awal → data terbaru terlewat

---

## B. FILE MAPPING

```
MODIFIED:
  src/lib/db.ts                          ← Fix #1: Tambah timezone: '+00:00'
  src/components/dashboard/usage-tab.tsx ← Fix #2: Tambah opsi 'today'
  src/app/v1/usage/route.ts             ← Fix #2: Support period 'today'
  src/app/dashboard/layout.tsx          ← Redesign: Integrasikan sidebar
  src/app/dashboard/page.tsx            ← Redesign: Refactor ke sidebar layout

CREATED:
  src/components/dashboard/dashboard-sidebar.tsx  ← Komponen sidebar baru
```

---

## C. MODULE SPECIFICATIONS

### 1. Fix Timezone (db.ts)

**Perubahan:** Tambah `timezone: '+00:00'` di MySQL pool config.

```typescript
pool = mysql.createPool({
  uri: url,
  timezone: '+00:00',  // Force UTC
  waitForConnections: true,
  connectionLimit: 10,
  // ...existing
});
```

**Efek:** Semua `NOW()` di MySQL akan mengembalikan UTC. Semua string datetime dari JavaScript (yang sudah UTC via `toISOString()`) akan diinterpretasikan benar.

### 2. Fix Usage Period "Hari Ini" (usage-tab.tsx + /v1/usage/route.ts)

**usage-tab.tsx:**
- Tambah `{ value: 'today', label: 'Hari Ini' }` ke array `PERIODS`

**/v1/usage/route.ts:**
- Case `'today'` sudah ada di switch (line 37-39) — tidak perlu ubah

### 3. Dashboard Sidebar (dashboard-sidebar.tsx)

Komponen sidebar baru menggunakan pattern dari shadcn sidebar component yang sudah ada di `src/components/ui/sidebar.tsx`.

**Struktur:**

```
┌──────────────────────────────────────────────────────┐
│  Logo/Title         [<] collapse button               │
├──────────────────────────────────────────────────────┤
│  [🔑] API Keys                                      │
│  [📖] Dokumentasi                                    │
│  [🔗] Endpoint                                       │
│  [📊] Penggunaan                                     │
├──────────────────────────────────────────────────────┤
│  [←] Kembali ke Chat                                 │
└──────────────────────────────────────────────────────┘
          ↓ content area →
┌──────────────────────────────────────────────────────┐
│  <Active Tab Content />                              │
└──────────────────────────────────────────────────────┘
```

**Expanded state (default):**
- Width: `16rem` (256px)
- Shows icon + label text
- Active item highlighted with accent background

**Collapsed state:**
- Width: `3rem` (48px)
- Shows only icons
- Tooltips on hover for label

**Fitur:**
- Responsive: di mobile (< 768px) sidebar menjadi sheet/drawer
- State persisted di localStorage (`dashboard_sidebar_state`)
- Transition animasi smooth
- Icon menggunakan `lucide-react` yang sudah ada

**Icons yang digunakan:**
- API Keys: `KeyRound` (modern, rounded key icon)
- Dokumentasi: `BookText` (open book with text)
- Endpoint: `Plug` (connection plug)
- Penggunaan: `Activity` (pulse/activity line)
- Kembali: `ArrowLeft`
- Collapse: `PanelLeftClose` / `PanelLeftOpen`

### 4. Layout & Page Refactor

**layout.tsx:**
- Bungkus children dengan `SidebarProvider` + layout grid sidebar + content

**page.tsx:**
- Hapus Tabs horizontal, ganti dengan state `activeSection` yang dikontrol sidebar
- Render komponen tab berdasarkan `activeSection`

---

## D. DATA FLOW

```
User navigates sidebar → activeSection state changes → conditional render tab component
                                                    
User visits /dashboard → layout.tsx renders sidebar + page.tsx → 
  page.tsx fetches /v1/usage → MySQL query (timezone: UTC) → 
  correct summary returned → display in usage-tab.tsx
```

### Error Handling
- Sidebar collapse state fallback: `expanded` jika localStorage unavailable
- Timezone fix: no error path — pool config change is transparent
- Responsive: sidebar auto-hides on mobile, accessible via hamburger

---

## E. EXECUTION SEQUENCE

### Step 1: Fix Timezone Bug
1. Edit `src/lib/db.ts` — tambah `timezone: '+00:00'` di pool config
2. Verifikasi: summary di dashboard seharusnya langsung menampilkan data

### Step 2: Add "Hari Ini" Period
1. Edit `src/components/dashboard/usage-tab.tsx` — tambah `{ value: 'today', label: 'Hari Ini' }` ke PERIODS
2. Verifikasi: opsi "Hari Ini" muncul di dropdown period

### Step 3: Create Dashboard Sidebar Component
1. Buat `src/components/dashboard/dashboard-sidebar.tsx`
2. Implement sidebar dengan expand/collapse, icons, active state
3. Responsive: mobile sheet drawer

### Step 4: Refactor Layout & Page
1. Edit `src/app/dashboard/layout.tsx` — integrasikan sidebar
2. Edit `src/app/dashboard/page.tsx` — ganti Tabs dengan sidebar-driven content

### Step 5: Verify
1. Jalankan dev server
2. Login, buka dashboard
3. Verifikasi: sidebar muncul, bisa expand/collapse, menu navigasi berfungsi
4. Verifikasi: usage stats menampilkan data (bukan 0)
5. Verifikasi: "Hari Ini" period berfungsi
6. Verifikasi: mobile responsive
