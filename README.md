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
npm run db:push             # buat tabel dari prisma/schema.prisma
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
| `npm run db:push` | Sinkronkan schema ke database |
| `npm run db:seed` | Isi data contoh |
| `npm run db:studio` | Prisma Studio |

---

## Struktur

```
actions/        Server Actions (satu-satunya jalur tulis ke database)
  projects.ts     CRUD proyek, statistik, deret bulanan
  categories.ts   CRUD kategori
app/            Halaman App Router
components/     Komponen UI
lib/            prisma client, util format, util kompresi gambar
prisma/         schema + seed
types/          Tipe bersama + kontrak ActionResult
tests/          Uji regresi logika murni
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

---

## Deploy

Butuh database PostgreSQL yang bisa dijangkau (mis. Neon, Supabase, Railway) dan
variabel `DATABASE_URL`. Jalankan `npm run db:push` (atau `prisma migrate deploy`
bila sudah memakai berkas migrasi) pada saat rilis.

> **Catatan:** repo ini belum memiliki folder `prisma/migrations/`, jadi schema
> saat ini disinkronkan dengan `db:push`. Untuk produksi jangka panjang, mulai
> memakai `prisma migrate dev` agar riwayat perubahan schema dapat dilacak dan
> di-rollback.
