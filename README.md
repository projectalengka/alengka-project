# Design Studio — Manajemen Proyek Desain

Aplikasi internal untuk mencatat dan mengelola proyek desain freelance: kategori layanan,
status pengerjaan, pendapatan, dan pembuatan invoice PDF.

Dibangun dengan **Next.js 15 (App Router)**, **React 19**, **Prisma 6**, **PostgreSQL**,
dan **Tailwind CSS v4**.

---

## Menjalankan

```bash
npm install
cp .env.example .env        # lalu isi DATABASE_URL
npm run db:deploy           # terapkan migrasi ke database
npm run db:seed             # opsional: data contoh
npm run dev                 # http://127.0.0.1:3000
```

### Skrip

| Skrip | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi |
| `npm run start` | Jalankan hasil build |
| `npm run check` | Type check (`tsc --noEmit`) |
| `npm run lint` | ESLint |
| `npm test` | Uji regresi (tanpa database) |
| `npm run db:migrate` | Buat + terapkan migrasi baru (pengembangan) |
| `npm run db:deploy` | Terapkan migrasi yang sudah ada (produksi/CI) |
| `npm run db:status` | Lihat status migrasi |
| `npm run db:seed` | Isi data contoh |
| `npm run db:push` | Sinkronkan schema tanpa migrasi — hindari di produksi |
| `npm run db:studio` | Prisma Studio |

### Kalau database sudah terlanjur dibuat dengan `db:push`

Database yang sudah punya tabel tetapi belum punya riwayat migrasi akan membuat
`db:deploy` menolak jalan. Tandai migrasi awal sebagai sudah diterapkan, sekali saja:

```bash
npx prisma migrate resolve --applied 20261013030036_init
npm run db:deploy
```

---

## Struktur

```
actions/        Server Actions (satu-satunya jalur tulis ke database)
  projects.ts     CRUD proyek, statistik, deret bulanan
  categories.ts   CRUD kategori
app/            Halaman App Router
components/     Komponen UI
lib/            prisma client, util format, analitik, util kompresi gambar
prisma/         schema + migrations + seed
  migrations/     riwayat perubahan schema (sumber kebenaran skema)
types/          Tipe bersama + kontrak ActionResult
tests/          Uji regresi logika murni
.github/        CI: typecheck, lint, test, migrasi ke Postgres nyata, build
```

---

## Keputusan desain yang perlu diketahui

**Server Action tidak melempar error.** Semua action mengembalikan
`ActionResult<T>` — `{ ok: true, data }` atau `{ ok: false, error }`. Pemanggil
wajib menangani kedua cabang, supaya tidak ada kegagalan yang hilang tanpa
pesan. Pesan `error` sudah berbahasa Indonesia dan aman ditampilkan.

**Sumber kebenaran data ada di satu tempat.** `getDashboardData()` mengembalikan
proyek + kategori + statistik sekaligus. Halaman tidak memanggil
`revalidatePath` (tidak berpengaruh pada state komponen klien) dan tidak
melakukan polling buta; penyegaran terjadi setelah mutasi dan saat tab kembali
aktif.

**Nilai uang memakai `Float`.** Untuk rupiah tanpa sen, konvensi proyek ini
adalah bilangan bulat. Jangan simpan pecahan sen di `Project.price`.

**Status proyek adalah enum di database.** Nilai Prisma memakai `On_Progress`
(identifier SQL tidak boleh berspasi), label UI tetap `"On Progress"`.
Penerjemahan hanya ada di `actions/projects.ts`.

**Gambar pratinjau diperkecil di peramban** (`lib/image.ts`) sebelum disimpan,
sehingga satu gambar biasanya di bawah 200KB. Kalau volume proyek bertambah
besar, langkah berikutnya yang wajar adalah memindahkannya ke object storage
dan menyimpan URL, bukan data URL.

**Nada warna kustom ada di `app/globals.css`.** Skala `neutral` bawaan Tailwind v4
hanya memuat 50/100/200/…/900/950. Kelas seperti `text-neutral-450` atau
`bg-neutral-850` yang dipakai di sini didefinisikan eksplisit di blok `@theme`;
tanpa definisi itu, kelas tersebut tidak menghasilkan CSS apa pun.

**Grafik pendapatan memakai konvensi pita.** Setiap titik diletakkan di tengah
bulannya, `x = (idx + 0.5) * (1100 / 12)`, dan label bulan memakai grid 12 kolom
yang sama. Dua baris itu harus bergeometri identik — dulu baris label memakai
`px-1` sementara baris grafik tidak, dan itu saja sudah menggeser label hingga
3,7px. Kalau mengubah tata letak grafik, ukur ulang pergeserannya; jangan
mengandalkan perkiraan mata.

---

## Deploy

Butuh database PostgreSQL yang bisa dijangkau (mis. Neon, Supabase, Railway) dan
variabel `DATABASE_URL`. Terapkan migrasi dengan:

```bash
npm run db:deploy
```

`db:deploy` hanya menjalankan migrasi yang belum diterapkan dan tidak pernah
menghapus data, jadi aman dipakai pada saat rilis. Jangan pakai `db:push` di
produksi — perintah itu menyamakan schema secara paksa tanpa mencatat riwayat.

> **Catatan build:** `next build` menulis berkas trace di `.next/`. Di sebagian
> lingkungan (folder yang dikunci antivirus/penyimpanan awan) langkah itu gagal
> dengan `EPERM ... .next/trace`. Setel `NEXT_TRACE_UPLOAD_DISABLED=1` untuk
> melewatinya; CI sudah menyetelnya.
