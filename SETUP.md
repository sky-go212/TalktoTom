# SKY-CHAT — Panduan Deploy Lengkap

## Prasyarat
- Node.js 18+ terinstall
- Akun Cloudflare (gratis)
- Akses ke repo ini di GitHub

---

## Langkah 1 — Clone & Install

```bash
git clone https://github.com/sky-go212/TalktoTom.git
cd TalktoTom
npm install

cd workers
npm install
```

---

## Langkah 2 — Setup Cloudflare (Dashboard)

### 2a. Buat D1 Database
1. Buka [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **D1**
2. Klik **Create database** → nama: `sky-chat-db`
3. Salin **Database ID** yang muncul
4. Edit `workers/wrangler.toml` → ganti `GANTI_SETELAH_BUAT_D1_DATABASE` dengan ID tersebut

### 2b. Enable R2 & Buat Bucket
1. Cloudflare Dashboard → **R2** → **Create bucket**
2. Nama bucket: `sky-chat-media` (harus tepat sama)
3. Lokasi: Auto

### 2c. Dapatkan Account ID
1. Cloudflare Dashboard → kanan bawah → salin **Account ID**
2. Edit `workers/wrangler.toml` → ganti `GANTI_DENGAN_ACCOUNT_ID`

---

## Langkah 3 — Deploy Workers Backend

```bash
cd workers

# Login ke Cloudflare (sekali saja)
npx wrangler login

# Set JWT secret (JANGAN pakai password lemah!)
npx wrangler secret put JWT_SECRET
# → Masukkan random string panjang, contoh: openssl rand -base64 32

# Jalankan migrasi database
node ../database/migrate.js

# Deploy Workers
npx wrangler deploy
```

Setelah deploy, salin URL Workers: `https://sky-chat.YOUR_SUBDOMAIN.workers.dev`

---

## Langkah 4 — Setup Admin Code

```bash
# Di folder root
WORKERS_URL=https://sky-chat.YOUR_SUBDOMAIN.workers.dev \
JWT_SECRET=your_jwt_secret \
node database/setup-admin.js
```

Simpan kode admin yang keluar — ini untuk login pertama kali.

---

## Langkah 5 — Deploy Frontend (Cloudflare Pages)

1. Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages**
2. **Connect to Git** → pilih repo `TalktoTom`
3. Konfigurasi build:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. **Environment variables** → tambah:
   | Variable | Value |
   |----------|-------|
   | `WORKERS_URL` | `https://sky-chat.YOUR_SUBDOMAIN.workers.dev` |
5. Klik **Save and Deploy**

---

## Langkah 6 — Setup GitHub Actions (Auto-Deploy)

Di GitHub repo → **Settings** → **Secrets and variables** → **Actions** → tambah:

| Secret | Value |
|--------|-------|
| `CF_API_TOKEN` | Cloudflare API Token (Workers:Edit permission) |
| `CF_ACCOUNT_ID` | Cloudflare Account ID |

Cara buat CF_API_TOKEN:
1. [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
2. **Create Token** → **Edit Cloudflare Workers** template
3. Salin token → simpan di GitHub Secrets

---

## Struktur Kode Admin Login

| Kode | Role | Akses |
|------|------|-------|
| `ADMIN-XXXX` | admin | Dashboard admin, buat SubServer |
| `MAIN-XXXX` | main | Chat grup, manage kontak |
| `XXXX` | contact | Chat grup & private saja |

---

## Troubleshooting

**Error: WORKERS_URL not configured**
→ Set env var `WORKERS_URL` di Cloudflare Pages Environment Variables

**WebSocket tidak connect**
→ Pastikan Workers sudah deploy & URL sudah benar di Pages env vars

**D1 error: table not found**
→ Jalankan `node database/migrate.js` untuk buat semua tabel

**KV sudah sedia** (tidak perlu buat baru)  
→ ID: `bd018c394d374b3b821e55d0dab84d6d`
