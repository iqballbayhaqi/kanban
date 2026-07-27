# Kanban

Aplikasi kanban board dengan checklist, prioritas, deadline, habit tracker harian,
dan halaman Master Kanban untuk melihat seluruh card lintas board dalam satu tabel.

Stack: React + TypeScript + Vite (frontend), Express + better-sqlite3 (backend),
pm2 + nginx (produksi).

---

## Hal yang paling sering salah diasumsikan

Baca bagian ini dulu. Semuanya pernah menyebabkan waktu terbuang.

| Asumsi | Kenyataan |
|---|---|
| Backend jalan di port yang sama di mana-mana | **Lokal 3001, produksi 3005.** Lihat [Port](#port) |
| `npm run dev` memakai data asli | Tidak — memakai `kanban.dev.db` yang **di-seed otomatis**. Lihat [Database](#database) |
| Akun di DB dev sama dengan akun asli | Email-nya sama, **password-nya tidak**. Lihat [Akun seed](#akun-seed) |
| Branch utama repo ini `master` | **`main`.** Lihat [Branch dan deploy](#branch-dan-deploy) |
| Deploy otomatis berjalan mulus | Pernah gagal berulang karena file lokal di VPS. Lihat [Kalau deploy gagal](#kalau-deploy-gagal) |
| `pm2 restart` membaca ulang `ecosystem.config.js` | Tidak. Lihat [Catatan pm2](#catatan-pm2) |
| `deploy/nginx.conf` = konfigurasi nginx yang hidup | Bukan. Sudah basi dan tanpa HTTPS. Lihat [nginx](#nginx) |

---

## Menjalankan lokal

Butuh Node 20+.

```bash
# backend
cd backend
npm install
npm run dev          # port 3001, pakai kanban.dev.db

# frontend (terminal terpisah)
cd frontend
npm install
npm run dev          # port 5173, proxy /api -> localhost:3001
```

Buka http://localhost:5173

### Port

| Lingkungan | Backend | Frontend | Keterangan |
|---|---|---|---|
| Lokal | **3001** | 5173 (Vite) | `server.js` default `process.env.PORT \|\| 3001`; proxy Vite menunjuk 3001 |
| Produksi | **3005** | nginx serve `frontend/dist` | Diset di `ecosystem.config.js`, di-proxy `deploy/nginx.conf` |

Perbedaan ini **disengaja**: port 3001 di VPS sudah dipakai aplikasi lain, jadi
produksi dipindah ke 3005 (commit `5b7c523`). Lokal tetap 3001.

Jangan "menyelaraskan" `vite.config.ts` ke 3005 — itu justru merusak dev lokal.
Kalau kamu perlu menjalankan backend lokal di 3005, set `PORT` secara eksplisit
dan sesuaikan proxy-nya, jangan ubah default.

---

## Database

SQLite, satu file, mode WAL. Path diambil dari env `DB_FILE`:

```js
// backend/db.js
const DB_FILE = process.env.DB_FILE || 'kanban.db';
// path relatif dihitung dari folder backend/
```

| File | Dipakai oleh | Isi |
|---|---|---|
| `backend/kanban.db` | `npm start`, `npm run prod`, produksi | Data asli |
| `backend/kanban.dev.db` | `npm run dev` | Data seed untuk coba-coba |

Semua `backend/*.db` (termasuk `-wal` dan `-shm`) sudah di-`.gitignore`.

### Akun seed

Kalau file DB belum ada, `initDb()` membuatnya lalu menyemai satu user dan
beberapa board contoh. Defaultnya:

| Env | Default |
|---|---|
| `SEED_EMAIL` | `baihaqiiqbal323@gmail.com` |
| `SEED_PASSWORD` | `changeme123` |
| `SEED_NAME` | `Admin` |

> **Jebakan:** email default sama persis dengan akun asli, tapi password-nya
> `changeme123`. Jadi di layar login DB seed terlihat identik dengan DB asli —
> kamu baru sadar salah DB setelah password ditolak. Kalau login gagal padahal
> merasa yakin, cek dulu DB mana yang sedang dilayani: backend mencetak
> `Using database: <path>` saat start.

Set `SEED_EMAIL=dev@local` di `.env` kalau ingin perbedaannya langsung kelihatan.

### Jangan commit dump database

`backend/migrate_data.json` adalah dump isi DB yang memuat email dan hash
password. Sudah di-`.gitignore` dan **tidak boleh** masuk repo — repo ini publik.
Berlaku juga untuk file `.db` dan `.env`.

---

## Struktur

```
backend/
  server.js              entry, mount semua route
  db.js                  koneksi, skema, migrasi, seed
  middleware/auth.js     verifikasi JWT
  routes/                auth, boards, columns, cards, checklist, habits
frontend/src/
  pages/                 Login, Dashboard, Board, Daily, Master
  components/            AppLayout, Sidebar, KanbanCard, CardModal, SelectMenu, ...
  api.ts                 instance axios + interceptor token
  types/index.ts         tipe bersama
deploy/
  nginx.conf             konfigurasi nginx produksi
  setup.sh               provisioning awal VPS
.github/workflows/
  deploy.yml             auto-deploy saat push ke main
```

### Catatan API

Sebagian besar route mengikuti pola `/api/<resource>`, dengan dua pengecualian
yang mudah terlewat:

- `routes/checklist.js` di-mount di `/api` (bukan `/api/checklist`), karena
  path-nya bersarang di bawah card.
- `GET /api/cards/all` dan `GET /api/columns/all` mengembalikan data lintas board
  untuk halaman Master Kanban. Route `/all` **harus** dideklarasikan sebelum
  `/:id`, kalau tidak akan tertangkap sebagai id.

Semua route (selain `/api/auth`) butuh header `Authorization: Bearer <token>`.

---

## Branch dan deploy

**Branch utama repo ini adalah `main`.** Semua PR harus menargetkan `main`.

`.github/workflows/deploy.yml` terpicu **hanya** oleh push ke `main`. Push ke
branch lain tidak men-deploy apa pun. Merge ke branch selain `main` juga tidak —
ini pernah terjadi dan membuat perubahan terlihat "sudah di-merge" padahal server
tidak pernah menerimanya.

Alur deploy di VPS:

```
git pull origin main
cd backend  && npm install --omit=dev
cd frontend && npm install && npm run build
pm2 restart kanban-backend --update-env
```

Produksi disajikan nginx dari `frontend/dist`, dengan `/api` di-proxy ke
`127.0.0.1:3005`. Domain: `kanban.balee.web.id`.

### Kalau deploy gagal

Penyebab yang sudah pernah terjadi dan kemungkinan besar berulang: **ada
perubahan lokal yang belum di-commit di working tree VPS**, sehingga `git pull`
batal:

```
error: Your local changes to the following files would be overwritten by merge:
	ecosystem.config.js
Aborting
```

Script memakai `set -e`, jadi deploy berhenti di langkah pertama — tidak ada
build, tidak ada restart, server tetap menjalankan versi lama. Sisi baiknya:
kegagalan ini tidak pernah meninggalkan deploy setengah jadi.

Cara membereskan — **lihat isinya dulu**, jangan langsung `reset --hard`, karena
file itu diubah manual dan bisa memuat nilai produksi yang tidak ada di repo:

```bash
ssh <user>@<host>
cd /var/www/kanban
git status
git diff ecosystem.config.js        # pindahkan dulu nilai yang masih dibutuhkan
git checkout -- ecosystem.config.js # baru buang
```

Kalau ada nilai yang memang khusus server, taruh di `.env` (tidak ikut ter-track)
alih-alih mengedit file yang ada di repo.

### Catatan pm2

`pm2 restart kanban-backend --update-env` **tidak** membaca ulang
`ecosystem.config.js`. Flag `--update-env` hanya menyegarkan env dari shell,
sedangkan konfigurasi app diambil dari yang tersimpan saat proses pertama
di-start. Jadi mengubah `env_production` di repo tidak berefek apa pun sampai:

```bash
pm2 delete kanban-backend
pm2 start ecosystem.config.js --env production
pm2 save
```

Ini yang membuat `DB_FILE: 'kanban.db'` di `ecosystem.config.js` sifatnya sekadar
dokumentasi niat — nilainya kebetulan sama dengan default di `db.js`, jadi tidak
ada bedanya kalau belum aktif.

### nginx

> **`deploy/nginx.conf` bukan konfigurasi yang sedang hidup di server.** File itu
> hanya cetak biru untuk provisioning awal (`deploy/setup.sh`).

Konfigurasi nyata ada di `/etc/nginx/sites-enabled/kanban` dan sudah berbeda:
Certbot menambahkan blok HTTPS di sana, sedangkan file di repo hanya punya
`listen 80`.

| | `deploy/nginx.conf` (repo) | `/etc/nginx/sites-enabled/kanban` (live) |
|---|---|---|
| HTTP | `listen 80` | `listen 80` + redirect ke HTTPS |
| HTTPS | tidak ada | `listen 443 ssl` + sertifikat Let's Encrypt |

Menyalin file repo menimpa konfigurasi live akan **mematikan HTTPS** situs.
Kalau perlu mengubah perilaku nginx, edit langsung file di server, atau salin
dulu blok `# managed by Certbot` dari sana.

### Jangan pernah menambal langsung di server

`ecosystem.config.js` pernah diedit manual di VPS (`PORT: 3001` → `3005`) tanpa
di-commit. Akibatnya `git pull` selalu batal dan **setiap deploy gagal selama
tujuh minggu** — termasuk deploy yang justru membawa perbaikan resmi untuk
masalah yang sama. Server diam-diam tertinggal 5 commit sementara semua orang
mengira sudah ter-deploy.

Kalau terpaksa menambal di server untuk memadamkan kebakaran, segera bawa
perubahannya ke repo dan bersihkan working tree VPS. Nilai yang memang khusus
server taruh di `.env`, bukan dengan mengedit file yang di-track git.

---

## Variabel lingkungan

Semua opsional; backend jalan tanpa `.env`.

| Nama | Default | Fungsi |
|---|---|---|
| `PORT` | `3001` | Port backend |
| `DB_FILE` | `kanban.db` | Nama/path file SQLite, relatif ke `backend/` |
| `JWT_SECRET` | `kanban-jwt-secret-dev-only` | **Wajib diganti di produksi** |
| `NODE_ENV` | — | `production` membuat Express ikut menyajikan `frontend/dist` |
| `SEED_EMAIL` / `SEED_PASSWORD` / `SEED_NAME` | lihat [Akun seed](#akun-seed) | Hanya dipakai saat DB pertama dibuat |
