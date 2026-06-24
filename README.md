# TalktoTom (SKY-CHAT)

Private real-time chat PWA dengan Cloudflare Workers backend.

## Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Cloudflare Workers (ESM)
- **Database**: Cloudflare D1 (SQLite)
- **Cache/Session**: Cloudflare KV
- **Media**: Cloudflare R2
- **WebSocket**: Cloudflare Durable Objects
- **Deploy**: Cloudflare Pages (frontend) + Workers (backend)

## Setup

### 1. Cloudflare Resources

Buat dari [Cloudflare Dashboard](https://dash.cloudflare.com):

```
D1 → Create database → sky-chat-db      → copy UUID
R2 → Enable R2 → Create bucket         → sky-chat-media
```

KV namespace sudah dibuat: `bd018c394d374b3b821e55d0dab84d6d`

### 2. Update wrangler.toml

```toml
# workers/wrangler.toml
account_id = "ACCOUNT_ID_ANDA"
database_id = "UUID_DARI_D1"
```

### 3. Set Worker Secrets

```bash
cd workers
npx wrangler secret put JWT_SECRET
# Masukkan string acak panjang saat prompted
```

### 4. Setup Admin

```bash
node database/setup-admin.js
# Output: 🔑 Admin Code: ADMIN-XXXXXX
```

Simpan kode admin — ini untuk login dan buat SubServer.

### 5. Deploy Workers

```bash
cd workers
npx wrangler deploy
```

### 6. Setup Cloudflare Pages

Di Cloudflare Pages → New project → Connect GitHub → TalktoTom:
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: `/`

Workers URL untuk environment variable di Pages (jika perlu):
- `VITE_API_URL` = `https://sky-chat-workers.YOUR_SUBDOMAIN.workers.dev`

### 7. GitHub Actions (auto-deploy)

Tambah secrets di GitHub repo → Settings → Secrets:
```
CF_API_TOKEN = Cloudflare API Token (Workers:Edit permission)
CF_ACCOUNT_ID = Cloudflare Account ID
```

Push ke `main` → Workers auto-deploy.

## Cara Kerja

1. **Admin** login dengan Admin Code → buat SubServer → dapat kode User Utama
2. **User Utama** login → tambah kontak → bagikan kode ke anggota
3. **Anggota** login dengan kode masing-masing → chat grup + DM

## Auto-Delete Policy

- Pesan teks: hapus otomatis setelah **48 jam**
- Media (gambar/audio): hapus setelah **24 jam**
- Cron berjalan setiap **1 jam**

## Struktur API

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/auth/validate` | POST | Login dengan kode |
| `/api/auth/session` | GET | Cek sesi aktif |
| `/api/auth/logout` | POST | Logout |
| `/api/admin/subserver` | GET/POST | CRUD SubServer (admin) |
| `/api/subserver/contacts` | GET/POST | Kelola kontak |
| `/api/subserver/contacts/:code` | DELETE | Hapus kontak |
| `/api/subserver/contacts/:code/reset` | POST | Reset kode |
| `/api/chat/group/history` | GET | Riwayat chat grup |
| `/api/chat/personal/rooms` | GET | Daftar DM |
| `/api/chat/personal/history` | GET | Riwayat DM |
| `/api/media/upload` | POST | Upload media |
| `/api/media/file/:key` | GET | Ambil media |
| `/websocket` | WS | WebSocket real-time |
| `/api/healthz` | GET | Health check |
