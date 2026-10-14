# scripts/

## `migrate-supabase.mjs`

Menjalankan `prisma migrate deploy` ke Supabase lewat **pooler session mode (port 5432)**.

Kenapa perlu: host `db.<ref>.supabase.co` hanya mengembalikan alamat IPv6 (di jaringan
tanpa route IPv6 koneksi itu selalu gagal), sedangkan pooler transaction mode (port 6543)
membuat `prisma migrate deploy` **menggantung tanpa batas** — terbukti pernah memblokir
build Vercel >20 menit.

Script ini menurunkan varian port 6543 -> 5432 secara otomatis dari `DATABASE_URL`.

```bash
npm run db:migrate:supabase
```

Migrasi sengaja **tidak** dijalankan saat build Vercel (`vercel-build` = `next build`)
supaya deploy tidak pernah tertahan menunggu migrasi.
