# Rencana Implementasi Arsitektur WS-First (Real-Time Sync)

## 1. Ringkasan Arsitektur
Tujuan dari migrasi ini adalah mengubah pola komunikasi aplikasi dari *Request-Response* berbasis HTTP menjadi *Event-Driven* berbasis WebSocket (WS). Hal ini akan menghilangkan masalah putus-sambung koneksi saat navigasi dan memberikan pengalaman real-time yang instan bagi pengguna.

### Komponen Utama:
- **`WebSocketProvider`**: Komponen wrapper global yang mengelola satu instance koneksi WebSocket tunggal untuk seluruh sesi aplikasi.
- **`WebSocketContext`**: Menyediakan akses ke fungsi `send` dan status koneksi ke seluruh komponen aplikasi.
- **`Zustand Store`**: Tetap menjadi *single source of truth* yang diperbarui secara otomatis melalui event yang diterima dari WebSocket.
- **`WS Server (server/websocket.js)`**: Diperluas untuk menangani permintaan data spesifik (Request-Response) selain hanya melakukan broadcast.

---

## 2. Tanggung Jawab Komponen

### A. WebSocketProvider (Client-Side)
- Menginisialisasi koneksi WebSocket saat aplikasi pertama kali dimuat.
- Mengelola logika *exponential backoff* untuk koneksi ulang (reconnection).
- Menyediakan fungsi `sendEvent(type, payload)` untuk mengirim pesan ke server.
- Mendengarkan semua pesan masuk dan meneruskannya ke handler yang sesuai (biasanya memperbarui Zustand store).

### B. Zustand Store (Client-Side)
- Menyimpan state aplikasi (models, user credit, dll).
- Menyediakan fungsi update yang dipanggil oleh `WebSocketProvider` saat menerima event `update` atau `sync` dari server.

### C. WebSocket Server (Server-Side)
- **Connection Management**: Melacak client yang terhubung.
- **Request Handler**: Menangani pesan masuk dengan tipe `request:*` (misal: `request:models`) dan mengirimkan response yang sesuai.
- **Broadcast Engine**: Mengirimkan update ke semua client saat ada perubahan data di database (misal: admin mengubah harga model).

---

## 3. Alur Data (Data Flow)

### A. Sinkronisasi Data Awal (Initial Sync)
1. `App Mount` $\rightarrow$ `WebSocketProvider` Connect.
2. `WebSocketProvider` mengirim event `{ type: 'request:initial_sync' }`.
3. `WS Server` mengambil data user, model, dan kredit dari DB.
4. `WS Server` mengirim response `{ type: 'response:initial_sync', data: { ... } }`.
5. `WebSocketProvider` memperbarui `Zustand Store` $\rightarrow$ UI terupdate otomatis.

### B. Update Real-Time (Admin $\rightarrow$ User)
1. `Admin` mengubah status model via HTTP API.
2. `HTTP API` memicu fungsi `broadcast()` di `websocket.js`.
3. `WS Server` mengirim event `{ type: 'model:update', model: { ... } }` ke semua client.
4. `WebSocketProvider` di sisi user menerima event $\rightarrow$ Update `Zustand Store` $\rightarrow$ UI berubah instan tanpa refresh.

---

## 4. Urutan Implementasi Step-by-Step

### Tahap 1: Infrastruktur Global (Client)
1. **Pembuatan Context**: Membuat `src/context/websocket-context.tsx` yang berisi `WebSocketProvider` dan `useWebSocketContext` hook.
2. **Integrasi Layout**: Membungkus `{children}` di `src/app/layout.tsx` dengan `WebSocketProvider`.
3. **Refactor Hook**: Mengubah `src/hooks/use-websocket.ts` agar tidak lagi membuat koneksi sendiri, melainkan menggunakan context dari `WebSocketProvider`.

### Tahap 2: Peningkatan Server (Server-Side)
1. **Request-Response Logic**: Menambahkan switch-case di `server/websocket.js` pada handler `ws.on('message')` untuk menangani tipe pesan `request:*`.
2. **Integrasi DB**: Menghubungkan `websocket.js` dengan database untuk mengambil data saat ada request sync.

### Tahap 3: Migrasi Fitur (Client-Side)
1. **Hapus Fetch Manual**: Menghapus pemanggilan `fetch('/api/models')` atau sejenisnya di `page.tsx` dan `admin/page.tsx`.
2. **Implementasi WS Request**: Menggantinya dengan `sendEvent('request:models')` saat komponen membutuhkan data terbaru.
3. **Cleanup**: Menghapus pemanggilan `useWebSocket()` di `src/app/page.tsx` karena sudah ditangani secara global.

---

## 5. Strategi Pengujian
- **Persistence Test**: Berpindah-pindah route (`/` $\rightarrow$ `/admin` $\rightarrow$ `/`) dan memastikan log server tidak menunjukkan `Disconnected` $\rightarrow$ `Connected`.
- **Real-time Test**: Membuka dua tab (User & Admin), mengubah data di Admin, dan memastikan tab User terupdate dalam $<100\text{ms}$.
- **Reconnection Test**: Mematikan server WS sementara, lalu menyalakannya kembali, dan memastikan client terhubung kembali secara otomatis.

## 6. Mitigasi Risiko
- **Race Condition**: Menggunakan timestamp atau sequence ID pada event untuk memastikan data terbaru yang menang.
- **Memory Leak**: Memastikan semua listener di server dibersihkan saat client disconnect.
- **Fallback**: Tetap mempertahankan endpoint HTTP untuk fungsi kritikal (Auth) agar aplikasi tetap bisa berjalan jika WS mengalami gangguan.
